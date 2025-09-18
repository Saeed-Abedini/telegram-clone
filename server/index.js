import { Server } from "socket.io";
import RoomSchema from "../src/schemas/roomSchema.js";
import MessageSchema from "../src/schemas/messageSchema.js";
import MediaSchema from "../src/schemas/mediaSchema.js";
import LocationSchema from "../src/schemas/locationSchema.js";
import UserSchema from "../src/schemas/userSchema.js";
import connectToDB from "../src/db/index.js";
const io = new Server(3001, {
  cors: {
    origin: "*",
  },
  pingTimeout: 30000,
  connectionStateRecovery: {
    maxDisconnectionDuration: 2 * 60 * 1000,
    skipMiddlewares: true,
  },
});

console.log("Socket server is running on port 3001");

let typings = [];
let onlineUsers = [];

await connectToDB();

io.on("connection", (socket) => {
  socket.on(
    "newMessage",
    async (
      { roomID, sender, message, replayData, voiceData = null, tempId },
      callback
    ) => {
      const msgData = {
        sender,
        message,
        roomID,
        seen: [],
        voiceData,
        createdAt: Date.now(),
        tempId,
        status: "sent",
      };

      let newMsg = await MessageSchema.findOne({ tempId }).lean();

      if (newMsg) {
        // Already exists, emit updates
        // Send newMessage to all users EXCEPT the sender
        socket.to(roomID).emit("newMessage", {
          ...newMsg,
          replayedTo: replayData ? replayData.replayedTo : null,
        });

        // Send newMessageIdUpdate ONLY to the sender
        socket.emit("newMessageIdUpdate", { tempId, _id: newMsg._id });

        // Broadcast other updates to all users
        io.to(roomID).emit("lastMsgUpdate", newMsg);
        io.to(roomID).emit("updateLastMsgData", {
          msgData: newMsg,
          roomID,
        });
        callback({ success: true, _id: newMsg._id });
      } else {
        // Create new
        newMsg = await MessageSchema.create(msgData);
        // Populate the sender field before sending
        const populatedMsg = await MessageSchema.findById(newMsg._id)
          .populate("sender", "name username avatar _id")
          .lean();

        // Send newMessage to all users EXCEPT the sender (they'll get newMessageIdUpdate)
        socket.to(roomID).emit("newMessage", {
          ...populatedMsg,
          replayedTo: replayData ? replayData.replayedTo : null,
        });

        // Send newMessageIdUpdate ONLY to the sender to update their pending message
        socket.emit("newMessageIdUpdate", {
          tempId,
          _id: populatedMsg._id,
        });

        // Broadcast lastMsgUpdate to all users
        io.to(roomID).emit("lastMsgUpdate", populatedMsg);
        io.to(roomID).emit("updateLastMsgData", {
          msgData: populatedMsg,
          roomID,
        });

        if (replayData) {
          await MessageSchema.findOneAndUpdate(
            { _id: replayData.targetID },
            { $push: { replays: newMsg._id } }
          );
          newMsg.replayedTo = replayData.replayedTo;
          await newMsg.save();
        }

        await RoomSchema.findOneAndUpdate(
          { _id: roomID },
          { $push: { messages: newMsg._id } }
        );

        callback({ success: true, _id: newMsg._id });
      }
    }
  );

  socket.on("createRoom", async ({ newRoomData, message = null }) => {
    let isRoomExist = false;

    if (newRoomData.type === "private") {
      isRoomExist = await RoomSchema.findOne({ name: newRoomData.name });
    } else {
      isRoomExist = await RoomSchema.findOne({ _id: newRoomData._id });
    }

    if (!isRoomExist) {
      let msgData = message;

      if (newRoomData.type === "private") {
        newRoomData.participants = newRoomData.participants.map(
          (data) => data?._id
        );
      }

      const newRoom = await RoomSchema.create(newRoomData);

      if (msgData) {
        const newMsg = await MessageSchema.create({
          ...msgData,
          roomID: newRoom._id,
        });
        msgData = newMsg;
        newRoom.messages = [newMsg._id];
        await newRoom.save();
      }

      socket.join(newRoom._id);

      const otherRoomMembersSocket = onlineUsers.filter((data) =>
        newRoom.participants.some((pID) => {
          if (data.userID === pID.toString()) return true;
        })
      );

      otherRoomMembersSocket.forEach(({ socketID: userSocketID }) => {
        const socketID = io.sockets.sockets.get(userSocketID);
        if (socketID) socketID.join(newRoom._id);
      });

      io.to(newRoom._id).emit("createRoom", newRoom);
    }
  });

  socket.on("joinRoom", async ({ roomID, userID }) => {
    const roomTarget = await RoomSchema.findOne({ _id: roomID });

    if (roomTarget && !roomTarget?.participants.includes(userID)) {
      roomTarget.participants = [...roomTarget.participants, userID];
      socket.join(roomID);
      await roomTarget.save();

      io.to(roomID).emit("joinRoom", { userID, roomID });
    }
  });

  socket.on("deleteRoom", async (roomID) => {
    io.to(roomID).emit("deleteRoom", roomID);
    io.to(roomID).emit("updateLastMsgData", { msgData: null, roomID });
    await RoomSchema.findOneAndDelete({ _id: roomID });
    await MessageSchema.deleteMany({ roomID });
  });

  socket.on("deleteMsg", async ({ forAll, msgID, roomID }) => {
    if (forAll) {
      io.to(roomID).emit("deleteMsg", msgID);
      const userID = onlineUsers.find((ud) => ud.socketID == socket.id)?.userID;

      await MessageSchema.findOneAndDelete({ _id: msgID });

      const lastMsg = await MessageSchema.findOne({
        roomID: roomID,
        hideFor: { $nin: [userID] },
      }).sort({ createdAt: -1 });

      if (lastMsg) {
        io.to(roomID).emit("updateLastMsgData", { msgData: lastMsg, roomID });
      }

      await RoomSchema.findOneAndUpdate(
        { _id: roomID },
        { $pull: { messages: msgID } }
      );
    } else {
      socket.emit("deleteMsg", msgID);

      const userID = onlineUsers.find((ud) => ud.socketID == socket.id)?.userID;

      if (userID) {
        await MessageSchema.findOneAndUpdate(
          { _id: msgID },
          {
            $push: { hideFor: userID },
          }
        );
      }

      const lastMsg = await MessageSchema.findOne({
        roomID: roomID,
        hideFor: { $nin: [userID] },
      }).sort({ createdAt: -1 });

      if (lastMsg) {
        socket.emit("updateLastMsgData", { msgData: lastMsg, roomID });
      }
    }
  });

  socket.on("editMessage", async ({ msgID, editedMsg, roomID }) => {
    io.to(roomID).emit("editMessage", { msgID, editedMsg, roomID });
    const updatedMsgData = await MessageSchema.findOneAndUpdate(
      { _id: msgID },
      { message: editedMsg, isEdited: true }
    ).lean();

    if (!updatedMsgData) return;

    const lastMsg = await MessageSchema.findOne({ roomID })
      .sort({ createdAt: -1 })
      .lean();

    if (lastMsg && lastMsg._id.toString() === msgID) {
      io.to(roomID).emit("updateLastMsgData", {
        roomID,
        msgData: { ...updatedMsgData, message: editedMsg },
      });
    }
  });

  socket.on("seenMsg", async (seenData) => {
    io.to(seenData.roomID).emit("seenMsg", seenData);
    try {
      await MessageSchema.findOneAndUpdate(
        { _id: seenData.msgID },
        {
          $push: {
            seen: seenData.seenBy,
          },
          $set: {
            readTime: new Date(seenData.readTime),
          },
        }
      );
    } catch (error) {
      console.log(error);
    }
  });

  socket.on("listenToVoice", async ({ userID, voiceID, roomID }) => {
    io.to(roomID).emit("listenToVoice", { userID, voiceID, roomID });

    const targetMessage = await MessageSchema.findOne({ _id: voiceID }).exec();
    const voiceMessagePlayedByList = targetMessage?.voiceData?.playedBy;

    if (!voiceMessagePlayedByList?.includes(userID)) {
      const userIdWithSeenTime = `${userID}_${new Date()}`;
      targetMessage.voiceData.playedBy = [
        ...voiceMessagePlayedByList,
        userIdWithSeenTime,
      ];
      targetMessage.save();
    }
  });

  socket.on("getVoiceMessageListeners", async (msgID) => {
    const {
      voiceData: { playedBy: playedByIds },
    } = await MessageSchema.findOne({ _id: msgID });

    const playedByIdsWithoutSeenTime = playedByIds.map((id) =>
      id?.includes("_") ? id.split("_")[0] : id
    );

    const playedByUsersData = await UserSchema.find({
      _id: { $in: playedByIdsWithoutSeenTime },
    }).lean();

    const findUserSeenTimeWithID = (id) => {
      let seenTime = null;

      playedByIds.some((str) => {
        const extractedID = str?.includes("_") ? str.split("_")[0] : str;
        if (extractedID === id.toString()) {
          seenTime = str?.includes("_") ? str.split("_")[1] : null;
          return true;
        }
      });

      return seenTime;
    };

    const userDataWithSeenDate = playedByUsersData.map((data) => ({
      ...data,
      seenTime: findUserSeenTimeWithID(data._id.toString()),
    }));

    socket.emit("getVoiceMessageListeners", userDataWithSeenDate);
  });

  socket.on("getRooms", async (userID) => {
    const userRooms = await RoomSchema.find({
      participants: { $in: userID },
    }).lean();

    const userPvs = await RoomSchema.find({
      $and: [{ participants: { $in: userID } }, { type: "private" }],
    })
      .lean()
      .populate("participants");

    for (const room of userRooms) {
      room.participants =
        userPvs.find((data) => data._id.toString() === room._id.toString())
          ?.participants || room.participants;
      socket.join(room._id.toString());
    }

    onlineUsers.push({ socketID: socket.id, userID });
    io.to([...socket.rooms]).emit("updateOnlineUsers", onlineUsers);

    const getRoomsData = async () => {
      const promises = userRooms.map(async (room) => {
        const lastMsgData = room?.messages?.length
          ? await MessageSchema.findOne({ _id: room.messages.at(-1)?._id })
          : null;

        const notSeenCount = await MessageSchema.find({
          $and: [
            { roomID: room?._id },
            { sender: { $ne: userID } },
            { seen: { $nin: [userID] } },
          ],
        });

        return {
          ...room,
          lastMsgData,
          notSeenCount: notSeenCount?.length,
        };
      });

      return Promise.all(promises);
    };

    const rooms = await getRoomsData();

    socket.emit("getRooms", rooms);
  });

  socket.on("joining", async (query, defaultRoomData = null) => {
    let roomData = await RoomSchema.findOne({
      $or: [{ _id: query }, { name: query }],
    })
      .populate("messages", "", MessageSchema)
      .populate("medias", "", MediaSchema)
      .populate("locations", "", LocationSchema)
      .populate({
        path: "messages",
        populate: {
          path: "sender",
          model: UserSchema,
        },
      })
      .populate({
        path: "messages",
        populate: {
          path: "replay",
          model: MessageSchema,
        },
      });

    if (roomData && roomData?.type === "private")
      await roomData.populate("participants");

    if (!roomData?._id) {
      roomData = defaultRoomData;
    }

    socket.emit("joining", roomData);
  });

  socket.on("pinMessage", async (id, roomID, isLastMessage) => {
    io.to(roomID).emit("pinMessage", id);

    const messageToPin = await MessageSchema.findOne({ _id: id });

    messageToPin.pinnedAt = messageToPin?.pinnedAt ? null : Date.now(); // toggle between pin & unpin
    await messageToPin.save();

    if (isLastMessage) {
      io.to(roomID).emit("updateLastMsgData", {
        msgData: messageToPin,
        roomID,
      });
    }
  });

  socket.on(
    "updateLastMsgPos",
    async ({ roomID, scrollPos, userID, shouldEmitBack = true }) => {
      try {
        const userTarget = await UserSchema.findOne({ _id: userID });

        if (!userTarget) {
          console.log(`User not found: ${userID}`);
          return;
        }

        if (!userTarget.roomMessageTrack) {
          userTarget.roomMessageTrack = [];
        }

        const isRoomExist = userTarget.roomMessageTrack.some((room) => {
          if (room.roomId === roomID) {
            room.scrollPos = scrollPos;
            return true;
          }
        });

        if (!isRoomExist) {
          userTarget.roomMessageTrack.push({ roomId: roomID, scrollPos });
        }

        if (shouldEmitBack) {
          socket.emit("updateLastMsgPos", userTarget.roomMessageTrack);
        }

        userTarget.save();
      } catch (error) {
        console.log("Error updating user data:", error);
      }
    }
  );

  socket.on("typing", (data) => {
    if (!typings.includes(data.sender.name)) {
      io.to(data.roomID).emit("typing", data);
      typings.push(data.sender.name);
    }
  });

  socket.on("stop-typing", (data) => {
    typings = typings.filter((tl) => tl !== data.sender.name);
    io.to(data.roomID).emit("stop-typing", data);
  });

  socket.on("updateUserData", async (updatedFields) => {
    await UserSchema.findOneAndUpdate(
      { _id: updatedFields.userID },
      updatedFields
    );
    socket.emit("updateUserData");
  });

  socket.on("updateRoomData", async (updatedFields) => {
    try {
      const { roomID, ...fieldsToUpdate } = updatedFields;

      const updatedRoom = await RoomSchema.findOneAndUpdate(
        { _id: roomID },
        { $set: fieldsToUpdate },
        { new: true }
      );

      if (!updatedRoom) {
        throw new Error("Room not found");
      }

      io.to(updatedFields.roomID).emit("updateRoomData", updatedRoom);

      const otherRoomMembersSocket = onlineUsers.filter((data) =>
        updatedRoom.participants.some((pID) => {
          if (data.userID === pID.toString()) return true;
        })
      );

      otherRoomMembersSocket.forEach(({ socketID: userSocketID }) => {
        const socketID = io.sockets.sockets.get(userSocketID);
        if (socketID) {
          socketID.emit("updateRoomData", updatedRoom);
        }
      });
    } catch (error) {
      console.error("Error updating room:", error);
      socket.emit("updateRoomDataError", { message: error.message });
    }
  });

  socket.on("getRoomMembers", async ({ roomID }) => {
    try {
      const roomMembers = await RoomSchema.findOne({ _id: roomID }).populate(
        "participants"
      );
      socket.emit("getRoomMembers", roomMembers.participants);
    } catch (err) {
      console.log(err);
      socket.emit("error", { message: "Unknown error, try later." });
    }
  });

  socket.on("disconnect", () => {
    onlineUsers = onlineUsers.filter((data) => data.socketID !== socket.id);
    io.to([...socket.rooms]).emit("updateOnlineUsers", onlineUsers);
  });
});

process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception:", err);
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection at:", promise, "reason:", reason);
});
