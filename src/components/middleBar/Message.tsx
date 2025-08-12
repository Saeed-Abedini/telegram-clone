import { useOnScreen } from "@/hook/useOnScreen";
import { dateString, getTimeFromDate, scrollToMessage } from "@/utils";
import { IoEye } from "react-icons/io5";
import { TiPin } from "react-icons/ti";
import Image from "next/image";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import MessageActions from "./MessageActions";
import MessageModel from "@/models/message";
import Voice from "@/models/voice";
import useSockets from "@/stores/useSockets";
import VoiceMessagePlayer from "./voice/VoiceMessagePlayer";
import { IoMdCheckmark } from "react-icons/io";
import useModalStore from "@/stores/modalStore";
import useGlobalStore from "@/stores/globalStore";
import ProfileGradients from "../modules/ProfileGradients";

interface Props {
  myId: string;
  addReplay: (_id: string) => void;
  edit: (data: MessageModel) => void;
  pin: (_id: string) => void;
  isPv?: boolean;
  voiceData?: Voice | null;
  stickyDate: string | null;
  nextMessage: MessageModel;
}

const Message = memo((msgData: MessageModel & Props) => {
  const {
    createdAt,
    message,
    seen,
    _id,
    sender,
    myId,
    roomID,
    replayedTo,
    isEdited,
    addReplay,
    edit,
    pin,
    isPv = false,
    nextMessage,
    voiceData: voiceDataProp,
    stickyDate,
  } = msgData;

  const [isMounted, setIsMounted] = useState(false);

  const messageRef = useRef<HTMLDivElement | null>(null);

  const rooms = useSockets((state) => state.rooms);
  const modalSetter = useModalStore((state) => state.setter);
  const isThisMessageSelected = useModalStore(
    useCallback((state) => state.msgData?._id === _id, [_id])
  );
  const setter = useGlobalStore((state) => state.setter);
  const selectedRoom = useGlobalStore((state) => state.selectedRoom);
  const [isInViewport, setIsInViewport] = useState<boolean>(false);
  useOnScreen(messageRef, setIsInViewport);

  //Calculate whether the message is the last message from the current sender.
  const isLastMessageFromUser = useMemo(
    () => !nextMessage || nextMessage.sender._id !== sender._id,
    [nextMessage, sender]
  );
  // Check if the message was sent from me
  const isFromMe = useMemo(() => sender?._id === myId, [sender, myId]);

  const isChannel = useMemo(() => {
    return selectedRoom?.type === "channel";
  }, [selectedRoom?.type]);

  const isMeJoined = useMemo(() => {
    if (!selectedRoom) return false;
    const { participants, admins, creator } = selectedRoom;
    return (
      participants.find((user) => user === myId) ||
      admins.includes(myId) ||
      creator === myId
    );
  }, [selectedRoom, myId]);

  const canMessageAction = isMeJoined && isThisMessageSelected;
  const messageTime = useMemo(() => getTimeFromDate(createdAt), [createdAt]);
  const stickyDates = useMemo(() => dateString(createdAt), [createdAt]);

  // Open the sender's profile
  const openProfile = () => {
    setter({
      RoomDetailsData: sender,
      shouldCloseAll: true,
      isRoomDetailsShown: true,
    });
  };

  //Update modal data (for editing, replying, and pinning)
  const updateModalMsgData = (e: React.MouseEvent) => {
    if (msgData._id === useModalStore.getState().msgData?._id) return;
    modalSetter((prev) => ({
      ...prev,
      clickPosition: { x: e.clientX, y: e.clientY },
      msgData,
      edit,
      reply: () => addReplay(_id),
      pin,
    }));
  };

  useEffect(() => {
    if (!isFromMe && !seen.some((id) => id === myId) && isInViewport && rooms) {
      rooms.emit("seenMsg", {
        seenBy: myId,
        sender,
        msgID: _id,
        roomID,
        readTime: new Date().toISOString(),
      });
    }
  }, [_id, isFromMe, isInViewport, myId, roomID, rooms, seen, sender]);

  //Set display state only once after mount.
  useEffect(() => {
    setIsMounted(true);
  }, []);

  return (
    <>
      {stickyDate && (
        <div
          className="static top-20 text-xs bg-gray-800/80 w-fit mx-auto text-center rounded-2xl py-1 my-2 px-3 z-10"
          data-date={stickyDates}
        >
          {stickyDate}
        </div>
      )}

      <div
        ref={messageRef}
        className={`chat transition-all duration-100 w-full  ${
          isFromMe ? "chat-end " : "chat-start"
        } ${isMounted ? "" : "opacity-0 scale-0"}`}
      >
        {/* Show sender avatar in received messages */}
        {!isFromMe &&
          !isPv &&
          !isChannel &&
          isLastMessageFromUser &&
          (sender.avatar ? (
            <div
              className="chat-image avatar cursor-pointer z-5"
              onClick={openProfile}
            >
              <div className="size-8 shrink-0 rounded-full">
                <Image
                  src={sender.avatar}
                  width={32}
                  height={32}
                  alt="avatar"
                  className="size-8 shrink-0 rounded-full "
                />
              </div>
            </div>
          ) : (
            <ProfileGradients
              classNames="size-8 chat-image avatar cursor-pointer z-10"
              id={sender?._id}
              onClick={openProfile}
            >
              {sender.name[0]}
            </ProfileGradients>
          ))}

        <div
          id="messageBox"
          onClick={updateModalMsgData}
          onContextMenu={updateModalMsgData}
          className={`relative grid break-all w-fit max-w-[80%] min-w-32 xl:max-w-[60%] py-0 rounded-t-xl transition-all duration-200
            ${
              isFromMe
                ? `${
                    !isLastMessageFromUser ? "rounded-br-md col-start-1" : ""
                  } ${
                    canMessageAction ? "bg-darkBlue/60" : "bg-darkBlue"
                  } rounded-bl-xl rounded-br-lg px-1`
                : `${
                    canMessageAction ? "bg-gray-800/60" : "bg-gray-800"
                  } pr-1 rounded-br-xl pl-1`
            }
            ${
              !isLastMessageFromUser &&
              !isFromMe &&
              `${
                !isPv && !isChannel ? `ml-8` : "ml-0"
              } rounded-bl-md col-start-2`
            }
            ${isLastMessageFromUser ? "chat-bubble" : ""}`}
        >
          {!isFromMe && !isPv && (
            <p
              dir="auto"
              className="w-full text-xs font-vazirBold pt-2 pl-1 text-[#13d4d4]"
            >
              {isChannel
                ? selectedRoom?.name
                : sender.name + " " + sender.lastName}
            </p>
          )}

          <div className="flex flex-col text-sm gap-1 p-1 mt-1 break-words mb-3">
            {replayedTo && (
              <div
                onClick={(e) => {
                  e.stopPropagation();
                  scrollToMessage(replayedTo?.msgID);
                }}
                className={`${
                  isFromMe
                    ? "bg-lightBlue/20 rounded-l-md"
                    : "bg-green-500/15 rounded-r-md"
                } cursor-pointer rounded-md rounded-t-md text-sm relative w-full py-1 px-3 overflow-hidden`}
              >
                <span
                  className={`absolute ${
                    isFromMe ? "bg-white" : "bg-green-500"
                  } left-0 inset-y-0 w-[3px] h-full`}
                ></span>
                <p className="font-vazirBold text-xs break-words text-start line-clamp-1 text-ellipsis">
                  {replayedTo.username}
                </p>
                <p className="font-thin break-words line-clamp-1 text-ellipsis text-left text-xs">
                  {replayedTo.message || "Voice Message"}
                </p>
              </div>
            )}
            {voiceDataProp && (
              <div className="flex items-center gap-3 bg-inherit w-full mt-2">
                <VoiceMessagePlayer
                  _id={_id}
                  voiceDataProp={voiceDataProp}
                  msgData={msgData}
                  isFromMe={isFromMe}
                  myId={myId}
                  roomID={roomID}
                />
              </div>
            )}
            <p dir="auto" className="text-white break-all ">
              {message}
            </p>
          </div>

          <span
            className={`flex items-end justify-end gap-1.5 absolute bottom-0 right-1 w-full text-sm ${
              isFromMe ? "text-[#B7D9F3]" : "text-darkGray"
            } text-right`}
          >
            {isChannel && (
              <div className="flex items-end text-[10px]">
                <IoEye size={14} className="mb-[1.2px] mr-[2px]" />
                {seen.length > 0 ? seen.length : ""}
              </div>
            )}
            {msgData?.pinnedAt && (
              <TiPin data-aos="zoom-in" className="size-4" />
            )}
            <p
              className={`whitespace-nowrap text-[10px] ${!isFromMe && "pr-1"}`}
            >
              {isEdited && "edited "} {messageTime}
            </p>
            {isFromMe &&
              !isChannel &&
              (seen?.length ? (
                <Image
                  src="/shapes/seen.svg"
                  width={15}
                  height={15}
                  className="size-4 mb-0.5 duration-500"
                  alt="seen"
                />
              ) : (
                <IoMdCheckmark
                  width={15}
                  height={15}
                  className="size-4 mb-0.5 rounded-full bg-center duration-500"
                />
              ))}
          </span>
        </div>
        {canMessageAction && <MessageActions isFromMe={isFromMe} />}
      </div>
    </>
  );
});

Message.displayName = "Message";

export default Message;
