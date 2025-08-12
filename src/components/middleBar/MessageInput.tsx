import { BsEmojiSmile } from "react-icons/bs";
import { IoMdClose } from "react-icons/io";
import { ChangeEvent, useCallback, useEffect, useRef, useState } from "react";
import { MdAttachFile, MdModeEditOutline, MdOutlineDone } from "react-icons/md";
import { BsFillReplyFill } from "react-icons/bs";
import VoiceMessageRecorder from "./voice/VoiceMessageRecorder";
import Message from "@/models/message";
import useGlobalStore from "@/stores/globalStore";
import useUserStore from "@/stores/userStore";
import useSockets from "@/stores/useSockets";
import { RiSendPlaneFill } from "react-icons/ri";
import { FaRegKeyboard } from "react-icons/fa6";
import { scrollToMessage, toaster } from "@/utils";
import EmojiPicker from "../modules/EmojiPicker";

interface Props {
  replayData?: Partial<Message>;
  editData?: Partial<Message>;
  closeReplay: () => void;
  closeEdit: () => void;
}

const MessageInput = ({
  replayData,
  editData,
  closeReplay,
  closeEdit,
}: Props) => {
  const [text, setText] = useState("");
  const typingTimer = useRef<NodeJS.Timeout | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const inputBoxRef = useRef<HTMLDivElement | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isEmojiOpen, setIsEmojiOpen] = useState(false);

  const selectedRoom = useGlobalStore((state) => state?.selectedRoom);
  const userRooms = useUserStore((state) => state.rooms);
  const { rooms } = useSockets((state) => state);
  const myData = useUserStore((state) => state);
  const roomId = selectedRoom?._id;

  //Helper function to reset the height of TextArea
  const resetTextAreaHeight = () => {
    if (inputRef.current) {
      inputRef.current.style.height = "24px";
    }
  };

  // Auto-resize TextArea
  const resizeTextArea = useCallback(() => {
    if (inputRef.current) {
      inputRef.current.style.height = "24px";
      inputRef.current.style.height = `${Math.min(
        inputRef.current.scrollHeight,
        100
      )}px`;
      inputRef.current.style.overflow =
        inputRef.current.scrollHeight > inputRef.current.offsetHeight
          ? "auto"
          : "hidden";
    }
  }, []);

  // Clean up after sending or editing a message
  const cleanUpAfterSendingMsg = useCallback(() => {
    resetTextAreaHeight();
    closeReplay();
    closeEdit();
    setText("");
    inputRef.current?.focus();
    if (roomId) localStorage.removeItem(roomId);
  }, [closeReplay, closeEdit, roomId]);

  // Send new message
  const sendMessage = useCallback(() => {
    const isExistingRoom = userRooms.some((room) => room._id === roomId);

    const payload = {
      roomID: roomId,
      message: text,
      sender: myData,
      replayData: replayData
        ? {
            targetID: replayData._id,
            replayedTo: {
              message: replayData.message,
              msgID: replayData._id,
              username: replayData.sender?.name,
            },
          }
        : null,
    };

    if (isExistingRoom) {
      rooms?.emit("newMessage", payload);
    } else {
      rooms?.emit("createRoom", {
        newRoomData: selectedRoom,
        message: { sender: myData, message: text },
      });
    }
    cleanUpAfterSendingMsg();
  }, [
    roomId,
    userRooms,
    text,
    myData,
    replayData,
    selectedRoom,
    rooms,
    cleanUpAfterSendingMsg,
  ]);

  // Edit existing message
  const editMessage = useCallback(() => {
    if (text.trim() === editData?.message?.trim()) {
      closeEdit();
      return;
    }
    rooms?.emit("editMessage", {
      msgID: editData?._id,
      editedMsg: text,
      roomID: roomId,
    });
    cleanUpAfterSendingMsg();
  }, [text, editData, rooms, roomId, cleanUpAfterSendingMsg, closeEdit]);

  //Send the "typing" event and stop it after 1500 milliseconds
  const handleIsTyping = useCallback(() => {
    if (typingTimer.current) {
      clearTimeout(typingTimer.current);
    }
    rooms?.emit("typing", { roomID: roomId, sender: myData });
    typingTimer.current = setTimeout(() => {
      rooms?.emit("stop-typing", { roomID: roomId, sender: myData });
    }, 1500);
  }, [rooms, roomId, myData]);

  // Text Change Handler
  const handleTextChange = useCallback(
    (e: ChangeEvent<HTMLTextAreaElement>) => {
      const newText = e.target.value;
      setText(newText);
      resizeTextArea();
      handleIsTyping();
    },
    [handleIsTyping, resizeTextArea]
  );

  // Add emoji to text
  const handleEmojiClick = useCallback((e: { emoji: string }) => {
    setText((prev) => prev + e.emoji);
  }, []);

  //Close keyBoard after open emoji
  useEffect(() => {
    if (isEmojiOpen) {
      document.getElementById("myInputField")?.blur();
    }
  }, [isEmojiOpen]);

  //Updating text in edit mode
  useEffect(() => {
    if (editData?.message) {
      setText(editData.message.trim());
    }
  }, [editData?.message]);

  //Focus on TextArea in Reply or Edit mode
  useEffect(() => {
    if (replayData?._id || editData?._id) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [replayData?._id, editData?._id]);

  //On mount, load draft from localStorage and focus on TextArea
  useEffect(() => {
    resizeTextArea();
    if (roomId) {
      const storedDraft = localStorage.getItem(roomId) || "";
      setText(storedDraft);
    } else {
      setText("");
    }
  }, [roomId, resizeTextArea]);

  //Synchronize text value with localStorage
  useEffect(() => {
    if (roomId) {
      if (text) {
        localStorage.setItem(roomId, text);
      } else {
        localStorage.removeItem(roomId);
      }
    }
  }, [text, roomId]);

  // Setting the ability to send messages in rooms
  const canSendMessage =
    selectedRoom?.type !== "channel" ||
    selectedRoom.admins.includes(myData._id);

  // Send a message by pressing Enter (if Shift is not held down)
  const handleKeyUp = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && text.trim().length) {
      e.preventDefault();
      if (editData) {
        editMessage();
      } else {
        sendMessage();
      }
    }
  };

  const handleCloseReplyEdit = () => {
    setText("");
    closeReplay();
    closeEdit();
  };

  return (
    <div className="sticky bottom-0 w-full flex flex-col justify-center bg-leftBarBg z-20">
      <div
        className={`${
          replayData?._id || editData?._id
            ? "opacity-100 h-12 py-1"
            : "opacity-0 h-0"
        } flex justify-between border-b border-chatBg duration-initial transition-all items-center gap-3 px-2 line-clamp-1 text-ellipsis  bg-leftBarBg w-full z-20 cursor-pointer`}
        onClick={() => {
          if (replayData?._id) {
            scrollToMessage(replayData?._id, "smooth", "center");
          }
          if (editData?._id) {
            scrollToMessage(editData?._id, "smooth", "center");
          }
        }}
      >
        <div className="flex items-center gap-3 line-clamp-1 text-ellipsis">
          {editData ? (
            <MdModeEditOutline className="size-6 text-lightBlue min-w-fit" />
          ) : (
            replayData && (
              <BsFillReplyFill className="size-6 text-lightBlue min-w-fit" />
            )
          )}
          <div className="flex flex-col text-left">
            <h4 className="text-lightBlue line-clamp-1 text-sm">
              {replayData
                ? `Reply to ${replayData.sender?.name}`
                : editData?.voiceData
                ? "Edit Caption"
                : editData && "Edit Message"}
            </h4>
            <p className="line-clamp-1 text-xs text-white/60">
              {replayData?.voiceData
                ? "Voice message"
                : replayData?.message ?? editData?.message}
            </p>
          </div>
        </div>
        <IoMdClose
          data-aos="zoom-in"
          onClick={(e) => {
            e.stopPropagation();
            handleCloseReplyEdit();
          }}
          className="size-7 min-w-fit transition-all cursor-pointer active:bg-red-500/[80%] active:rounded-full p-1"
        />
      </div>

      <div
        className="flex items-center justify-between relative min-h-12 w-full md:px-2 px-3 gap-3 bg-leftBarBg duration-75 transition-all"
        ref={inputBoxRef}
      >
        {canSendMessage ? (
          <>
            {isEmojiOpen ? (
              <FaRegKeyboard
                onClick={() => {
                  setIsEmojiOpen(false);
                  inputRef.current?.focus();
                }}
                className="cursor-pointer size-6 mr-0.5"
              />
            ) : (
              <BsEmojiSmile
                onClick={() => setIsEmojiOpen(true)}
                className="cursor-pointer size-6 mr-0.5"
              />
            )}
            <textarea
              dir="auto"
              autoComplete="offtextarea"
              value={text}
              onChange={handleTextChange}
              onContextMenu={(e) => e.stopPropagation()}
              onClick={() => setIsEmojiOpen(false)}
              onKeyUp={handleKeyUp}
              ref={inputRef}
              className="bg-transparent w-full resize-none outline-none scroll-w-none"
              placeholder="Message"
            />
            {!editData && !text.trim() && (
              <MdAttachFile
                data-aos="zoom-in"
                className="size-7 cursor-pointer w-fit rotate-[215deg]"
                onClick={() =>
                  toaster(
                    "info",
                    "File upload feature is coming soon! Stay tuned for updates. 🚀"
                  )
                }
              />
            )}
            {editData?._id ? (
              <button
                className={`p-1 cursor-pointer text-white bg-lightBlue flex-center rounded-full ${
                  !text.trim() ? "opacity-30" : "opacity-100"
                }`}
                onClick={editMessage}
                disabled={!text.trim()}
              >
                <MdOutlineDone data-aos="zoom-in" size={20} />
              </button>
            ) : (
              <>
                {text.trim().length ? (
                  <RiSendPlaneFill
                    data-aos="zoom-in"
                    onClick={sendMessage}
                    className="size-7 cursor-pointer text-lightBlue mr-2 rotate-45"
                  />
                ) : (
                  <VoiceMessageRecorder
                    replayData={replayData}
                    closeEdit={closeEdit}
                    closeReplay={closeReplay}
                  />
                )}
              </>
            )}
          </>
        ) : (
          <div
            onClick={() => setIsMuted((prev) => !prev)}
            className="absolute cursor-pointer flex items-center justify-center pt-3 text-center w-full mb-1"
          >
            {isMuted ? "Unmute" : "Mute"}
          </div>
        )}
      </div>

      {isEmojiOpen && (
        <div data-aos="fade-up" data-aos-duration="200">
          <EmojiPicker
            handleEmojiClick={handleEmojiClick}
            isEmojiOpen={isEmojiOpen}
          />
        </div>
      )}
    </div>
  );
};

export default MessageInput;
