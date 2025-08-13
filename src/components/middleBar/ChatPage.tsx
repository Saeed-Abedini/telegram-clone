"use client";

import {
  lazy,
  Suspense,
  useEffect,
  useMemo,
  useState,
  useCallback,
} from "react";
import { IoIosArrowUp, IoMdArrowRoundBack } from "react-icons/io";
import Image from "next/image";
import { PiDotsThreeVerticalBold } from "react-icons/pi";
import MessageSender from "./MessageInput";
import JoinToRoom from "./JoinToRoom";
import useUserStore from "@/stores/userStore";
import useGlobalStore from "@/stores/globalStore";
import useSockets from "@/stores/useSockets";
import MessageModel from "@/models/message";
import { FiBookmark } from "react-icons/fi";
import Loading from "../modules/ui/Loading";
import User from "@/models/user";
import DropDown from "../modules/ui/DropDown";
import { IoLogOutOutline } from "react-icons/io5";
import useModalStore from "@/stores/modalStore";
import Modal from "../modules/ui/Modal";
import { scrollToMessage } from "@/utils";
import ProfileGradients from "../modules/ProfileGradients";

const ChatBox = lazy(() => import("./ChatBox"));

export interface msgDate {
  date: string;
  usedBy: string;
}

const ChatPage = () => {
  const {
    _id: myID,
    name: myName,
    setter: userDataUpdater,
  } = useUserStore((state) => state);
  const { rooms: roomsSocket } = useSockets((state) => state);
  const { selectedRoom, onlineUsers, isRoomDetailsShown, setter } =
    useGlobalStore((state) => state) || {};
  const { setter: modalSetter } = useModalStore((state) => state);
  const [typings, setTypings] = useState<string[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [showRoomOptions, setShowRoomOptions] = useState(false);
  const [replayData, setReplayData] = useState<string | null>(null);
  const [editData, setEditData] = useState<MessageModel | null>(null);
  const { messages, type, participants } = selectedRoom!;

  // Avatar, name and _id information from room or user information (in private mode)
  const {
    avatar = "",
    name = "",
    lastName = "",
    _id,
  } = useMemo(() => {
    const roomOrUser =
      type === "private"
        ? participants?.find(
            (data) => typeof data !== "string" && data?._id !== myID
          ) ||
          participants?.find(
            (data) => typeof data !== "string" && data?._id === myID
          ) ||
          selectedRoom
        : selectedRoom || null;

    if (roomOrUser && typeof roomOrUser !== "string") {
      return {
        avatar: roomOrUser.avatar || "",
        name: roomOrUser.name || "",
        lastName: (roomOrUser as User).lastName || "",
        _id: roomOrUser._id || "",
      };
    }
    return { avatar: "", name: "", _id: "", lastName: "" };
  }, [myID, participants, selectedRoom, type]);

  // Calculate the replay message based on replayData (which is the message ID)
  const replayDataMsg = useMemo(() => {
    return messages?.find((msg) => msg._id === replayData);
  }, [messages, replayData]);

  // Calculate pinned messages from messages
  const pinnedMessages = useMemo(() => {
    return messages?.filter((msg) => msg.pinnedAt) || [];
  }, [messages]);

  // Calculate the number of online members (to display in the header)
  const onlineMembersCount = useMemo(() => {
    if (!onlineUsers?.length || !participants?.length) return 0;
    return participants.filter((pId) =>
      onlineUsers.some((data) => data.userID === pId)
    ).length;
  }, [onlineUsers, participants]);

  // Define an event handler for returning (back) from the room
  const handleBack = useCallback(() => {
    setter({ selectedRoom: null, isRoomDetailsShown: false });
  }, [setter]);

  // Event handler for receiving pinned message
  const handlePinMessage = useCallback(
    (msgId: string) => {
      const updatedMessages = messages.map((msg) =>
        msg._id === msgId
          ? { ...msg, pinnedAt: msg.pinnedAt ? null : String(Date.now()) }
          : msg
      );
      setter({
        selectedRoom: {
          ...selectedRoom!,
          messages: updatedMessages,
        },
      });
    },
    [messages, selectedRoom, setter]
  );

  // Register an event listener for the "pinMessage" event from the server
  useEffect(() => {
    roomsSocket?.on("pinMessage", handlePinMessage);
    return () => {
      roomsSocket?.off("pinMessage", handlePinMessage);
    };
  }, [roomsSocket, handlePinMessage]);

  // Remove user from selected group or channel
  const leaveRoom = () => {
    const newParticipants = participants.filter(
      (participant) => participant !== myID
    );
    roomsSocket?.emit("updateRoomData", {
      roomID: selectedRoom?._id,
      participants: [...newParticipants],
    });
    roomsSocket?.once("updateRoomData", ({ _id, participants }) => {
      userDataUpdater((prev) => ({
        ...prev,
        rooms: prev.rooms.map((room) =>
          room._id === _id ? { ...room, participants } : room
        ),
      }));
      setter({
        selectedRoom: { ...selectedRoom!, participants },
      });
    });
  };

  const dropDownItems = [
    {
      title: "Go to first message",
      icon: <IoIosArrowUp className="size-5 text-gray-400" />,
      onClick: () => {
        setShowRoomOptions(false);
        const firstMessage = messages[0]?._id;
        if (firstMessage) {
          scrollToMessage(messages[0]?._id);
        }
      },
    },
    type !== "private" && {
      title: type === "group" ? "Leave group" : "Leave Channel",
      icon: <IoLogOutOutline className="size-5 text-gray-400" />,
      onClick: () => {
        setShowRoomOptions(false);
        modalSetter((prev) => ({
          ...prev,
          isOpen: true,
          title: type === "group" ? "Leave group" : "Leave Channel",
          bodyText: `Are you sure you want to leave ${selectedRoom?.name}?`,
          onSubmit: async () => {
            leaveRoom();
            setTimeout(() => {
              setter({ selectedRoom: null });
            }, 500);
          },
        }));
      },
    },
  ]
    .map((item) => item || null)
    .filter((item) => item !== null);

  return (
    <div
      data-aos="fade"
      style={{ transform: "none" }}
      className="relative h-dvh flex flex-col chatBackground w-full "
    >
      {/* Chat Header */}
      <div
        id="chatContentHeader"
        className="sticky top-0  flex items-center justify-between h-17 p-2  w-full border-b border-white/5 bg-leftBarBg"
        style={{ zIndex: "20" }}
      >
        <div className="flex items-center gap-5 w-full  overflow-hidden">
          <IoMdArrowRoundBack
            onClick={handleBack}
            className="cursor-pointer size-6 text-white/80"
          />

          <div
            onClick={() =>
              setter({
                isRoomDetailsShown: !isRoomDetailsShown,
                RoomDetailsData: null,
              })
            }
            className="flex items-center cursor-pointer gap-3 truncate max-w-[80%]"
          >
            {_id === myID ? (
              <div className="size-11 bg-cyan-700 rounded-full shrink-0 flex-center text-white text-2xl">
                <FiBookmark />
              </div>
            ) : avatar ? (
              <Image
                src={avatar}
                width={44}
                height={44}
                className="size-11 mt-auto object-center shrink-0 object-cover rounded-full"
                alt="avatar"
              />
            ) : (
              <ProfileGradients
                classNames="size-11 text-center text-xl"
                id={_id}
              >
                {name?.length && name[0]}
              </ProfileGradients>
            )}

            <div className="flex justify-center flex-col gap-1 truncate">
              <h3 className="text-base font-vazirBold truncate">
                {_id === myID ? "Saved messages" : name + " " + lastName}
              </h3>

              <div className="text-sm text-darkGray font-vazirBold line-clamp-1 whitespace-normal text-nowrap">
                {selectedRoom?.type !== "channel" &&
                typings.length &&
                typings.filter((tl) => tl !== myName).length ? (
                  <div className="text-lightBlue whitespace-normal line-clamp-1">
                    {typings.join(", ") +
                      (typings.length > 1 ? " are" : " is") +
                      " typing "}
                    <span className="animate-ping font-extrabold font-vazirBold">
                      ...
                    </span>
                  </div>
                ) : (
                  <>
                    {type === "private" ? (
                      onlineUsers.some((data) => data.userID === _id) ? (
                        <span className="text-lightBlue">Online</span>
                      ) : (
                        "last seen recently"
                      )
                    ) : type === "group" ? (
                      `${participants.length} members ${
                        onlineMembersCount
                          ? ", " + onlineMembersCount + " online"
                          : ""
                      }`
                    ) : (
                      `${participants.length} subscribers`
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 justify-end">
          <DropDown
            button={
              <PiDotsThreeVerticalBold
                onClick={() => setShowRoomOptions(true)}
                size={20}
                className="w-fit cursor-pointer mr-2"
              />
            }
            dropDownItems={dropDownItems}
            isOpen={showRoomOptions}
            setIsOpen={setShowRoomOptions}
            classNames="top-5 right-0 w-fit text-nowrap"
          />
        </div>
      </div>

      {/* Chat Message */}
      <Suspense
        fallback={
          <div className="size-full flex-center">
            <Loading size="lg" />
          </div>
        }
      >
        <ChatBox
          setTypings={setTypings}
          pinnedMessages={pinnedMessages}
          setEditData={setEditData}
          setReplayData={setReplayData}
          isLoaded={isLoaded}
          _id={_id}
          setIsLoaded={setIsLoaded}
        />
      </Suspense>

      {/* If the room type is private or the user is a member of a group, MessageSender is displayed */}
      {type === "private" || (participants as string[]).includes(myID) ? (
        <MessageSender
          replayData={replayDataMsg}
          editData={editData!}
          closeEdit={() => setEditData(null)}
          closeReplay={() => setReplayData(null)}
        />
      ) : (
        <JoinToRoom
          roomData={selectedRoom!}
          roomSocket={roomsSocket}
          userID={myID}
        />
      )}
      {isRoomDetailsShown && (
        <span
          onClick={() => setter({ isRoomDetailsShown: false })}
          className="inset-0 xl:static absolute transition-all duration-200 "
        ></span>
      )}
      <Modal />
    </div>
  );
};

export default ChatPage;
