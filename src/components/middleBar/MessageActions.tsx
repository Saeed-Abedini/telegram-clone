"use client";

import { copyText, deleteFile, getTimeReportFromDate } from "@/utils";
import { GoReply } from "react-icons/go";
import {
  MdContentCopy,
  MdOutlineModeEdit,
  MdOutlinePlayCircle,
} from "react-icons/md";
import { IoArrowBackOutline } from "react-icons/io5";
import { AiOutlineDelete } from "react-icons/ai";
import { LuPin } from "react-icons/lu";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
} from "react";
import useSockets from "@/stores/useSockets";
import useUserStore from "@/stores/userStore";
import User from "@/models/user";
import Modal from "../modules/ui/Modal";
import DropDown from "../modules/ui/DropDown";
import useModalStore from "@/stores/modalStore";
import useAudio from "@/stores/audioStore";
import useGlobalStore from "@/stores/globalStore";
import Image from "next/image";
import Message from "@/models/message";
import ProfileGradients from "../modules/ProfileGradients";
import { formatDateByDistance } from "@/utils/Date/formatDateByDistance";

interface MessageActionsProps {
  isFromMe: boolean;
}

type PlayedByUsersData = User & { seenTime: string };

const MessageActions = ({ isFromMe }: MessageActionsProps) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [playedByUsersData, setPlayedByUsersData] = useState<
    PlayedByUsersData[]
  >([]);
  const [dropDownPosition, setDropDownPosition] = useState({ x: 0, y: 0 });
  const [isDropDownOpen, setIsDropDownOpen] = useState(false);

  const {
    setter: modalSetter,
    msgData,
    isChecked,
  } = useModalStore((state) => state);
  const { setter, selectedRoom } = useGlobalStore((state) => state);
  const roomSocket = useSockets((state) => state.rooms);
  const myID = useUserStore((state) => state._id);
  const isUserChannel = selectedRoom?.type === "channel" && !isFromMe;

  const roomData = useMemo(() => {
    const rooms = useUserStore.getState()?.rooms;
    return rooms.find((room) => room._id === msgData?.roomID);
  }, [msgData?.roomID]);

  const onClose = useCallback(() => {
    setIsDropDownOpen(false);
    modalSetter((prev) => ({ ...prev, msgData: null }));
  }, [modalSetter]);

  const copy = useCallback(() => {
    if (msgData) copyText(msgData.message);
    onClose();
  }, [msgData, onClose]);

  const deleteMessage = useCallback(() => {
    setIsDropDownOpen(false);
    modalSetter((prev) => ({
      ...prev,
      isOpen: true,
      title: "Delete message",
      bodyText: "Are you sure you want to delete this message?",
      isCheckedText: "Also delete for others",
      onSubmit: async () => {
        const currentIsChecked = useModalStore.getState().isChecked;

        if (msgData?.voiceData?.src) {
          if (useAudio.getState().voiceData?.src === msgData.voiceData.src) {
            useAudio.getState().toggleAudioPlayback();
            useAudio
              .getState()
              .setter({ currentTime: 0, isPlaying: false, voiceData: null });
          }
          if (currentIsChecked) {
            await deleteFile(msgData.voiceData.src);
          }
        }

        roomSocket?.emit("deleteMsg", {
          forAll: currentIsChecked,
          msgID: msgData?._id,
          roomID: msgData?.roomID,
        });
        onClose();
      },
    }));

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [msgData, isChecked, roomSocket]);

  const openProfile = useCallback(
    (profileData: User) => {
      setter({
        RoomDetailsData: profileData,
        shouldCloseAll: true,
        isRoomDetailsShown: true,
      });
      modalSetter((prev) => ({ ...prev, msgData: null }));
    },
    [modalSetter, setter]
  );

  const actionHandler = useCallback(
    (action?: ((data: Message) => void) | ((_id: string) => void)) => () => {
      if (msgData && action) {
        if ((action as (_id: string) => void).length === 1) {
          (action as (_id: string) => void)(msgData._id);
        } else {
          (action as (data: Message) => void)(msgData);
        }
        onClose();
      }
    },
    [msgData, onClose]
  );

  useEffect(() => {
    if (!roomSocket || !msgData?._id || !msgData?.voiceData?.playedBy?.length)
      return;

    roomSocket.emit("getVoiceMessageListeners", msgData._id);
    roomSocket.on("getVoiceMessageListeners", setPlayedByUsersData);

    return () => {
      if (roomSocket) {
        roomSocket.off("getVoiceMessageListeners");
      }
    };
  }, [roomSocket, msgData]);

  const dropDownItems = useMemo(
    () =>
      [
        msgData?.voiceData?.playedBy?.length &&
          !isUserChannel && {
            title: isCollapsed ? (
              "Back"
            ) : (
              <div className="flex relative justify-between items-center w-full ">
                <span>Played by</span>
                {playedByUsersData?.length > 0 && (
                  <span>
                    {playedByUsersData.slice(0, 2).map((user, index) =>
                      user.avatar ? (
                        <Image
                          key={user._id}
                          width={24}
                          height={24}
                          loading="lazy"
                          style={{
                            position: "absolute",
                            right: index === 1 ? "10px" : "0",
                            top: 0,
                            zIndex: index,
                          }}
                          className="object-cover size-6 rounded-full shrink-0"
                          src={user?.avatar}
                          alt="avatar"
                        />
                      ) : (
                        <ProfileGradients
                          key={user._id}
                          classNames="size-6 text-center text-md border border-gray-800 p-1 pt-2"
                          id={user._id}
                          style={{
                            position: "absolute",
                            right: index === 1 ? "10px" : "0",
                            top: 0,
                            zIndex: index,
                          }}
                        >
                          {user.name[0]}
                        </ProfileGradients>
                      )
                    )}
                  </span>
                )}
              </div>
            ),
            icon: isCollapsed ? (
              <IoArrowBackOutline className="size-5  text-gray-400 mb-1" />
            ) : (
              <MdOutlinePlayCircle className="size-5  text-gray-400 mb-1" />
            ),
            onClick: () => setIsCollapsed((prev) => !prev),
            itemClassNames: "border-b-3 border-chatBg",
          },
        roomData?.type === "private" &&
          msgData?.sender._id === myID &&
          msgData?.seen?.length &&
          msgData?.readTime &&
          !isCollapsed && {
            title: (
              <div className="flex relative justify-between items-center w-full">
                read{" "}
                {msgData?.readTime
                  ? formatDateByDistance(
                      new Date(msgData.readTime).toISOString()
                    )
                  : ""}
              </div>
            ),
            icon: (
              <Image
                src="/shapes/seen.svg"
                width={15}
                height={15}
                className="size-4 mb-0.5 duration-500"
                alt="seen"
              />
            ),
            itemClassNames: "border-b-3 border-chatBg",
          },
        ...(!isCollapsed
          ? [
              roomData?.type !== "channel" && {
                title: "Reply",
                icon: <GoReply className="size-5  text-gray-400 " />,
                onClick: actionHandler(msgData?.addReplay),
              },
              (roomData?.type !== "channel" ||
                roomData?.admins?.includes(myID)) && {
                title: msgData?.pinnedAt ? "Unpin" : "Pin",
                icon: <LuPin className="size-5  text-gray-400 " />,
                onClick: actionHandler(msgData?.pin),
              },
              {
                title: "Copy",
                icon: <MdContentCopy className="size-5  text-gray-400 " />,
                onClick: copy,
              },
              msgData?.sender._id === myID && {
                title: "Edit",
                icon: <MdOutlineModeEdit className="size-5  text-gray-400 " />,
                onClick: actionHandler(msgData?.edit),
              },
              (roomData?.type === "private" ||
                msgData?.sender._id === myID ||
                roomData?.admins?.includes(myID)) && {
                title: "Delete",
                icon: <AiOutlineDelete className="size-5  text-gray-400 " />,
                onClick: deleteMessage,
              },
            ]
          : playedByUsersData.map((user) => ({
              title: (
                <div className="flex w-full justify-between mt-1">
                  <span className="-ml-2">
                    {user?._id == myID ? "You" : user?.name}
                  </span>
                  <span>{getTimeReportFromDate(user.seenTime)}</span>
                </div>
              ),
              icon: user.avatar ? (
                <Image
                  key={user._id}
                  width={24}
                  height={24}
                  className="object-cover size-6 rounded-full"
                  src={user.avatar}
                  alt="user avatar"
                />
              ) : (
                <ProfileGradients
                  key={user._id}
                  classNames="size-6 text-center text-md p-1 pt-2"
                  id={user._id}
                >
                  {user.name[0]}
                </ProfileGradients>
              ),
              onClick: () => openProfile(user),
            }))),
      ]
        .map((item) => item || null)
        .filter((item) => item !== null),
    [
      isCollapsed,
      msgData,
      roomData,
      myID,
      playedByUsersData,
      copy,
      deleteMessage,
      actionHandler,
      openProfile,
      isUserChannel,
    ]
  );

  useLayoutEffect(() => {
    const calculatePosition = () => {
      const { clickPosition } = useModalStore.getState();
      if (!clickPosition) return;

      const viewport = {
        width: window.innerWidth,
        height: window.innerHeight,
      };

      const menuSize = {
        width: isCollapsed ? 260 : 200,
        // height: dropDownItems.length * 40 + 20, //Approximate height of each item 40px
        height: isCollapsed ? 6 * 40 + 20 : dropDownItems.length * 40 + 20,
      };

      const adjustedPosition = { ...clickPosition };

      //Horizontal position adjustment
      if (clickPosition.x + menuSize.width > viewport.width) {
        adjustedPosition.x = viewport.width - menuSize.width - 10;
      }

      // Vertical position adjustment
      if (clickPosition.y + menuSize.height > viewport.height) {
        adjustedPosition.y = clickPosition.y - menuSize.height - 10;
      } else {
        adjustedPosition.y += 10;
      }

      setDropDownPosition(adjustedPosition);
    };

    calculatePosition();

    window.addEventListener("resize", calculatePosition);

    return () => {
      window.removeEventListener("resize", calculatePosition);
    };
  }, [isCollapsed, dropDownItems.length]);

  useEffect(() => {
    if (Boolean(msgData)) {
      setIsDropDownOpen(true);
    }
  }, [msgData]);
  return (
    <>
      <DropDown
        button={<></>}
        dropDownItems={dropDownItems}
        setIsOpen={onClose}
        isOpen={Boolean(msgData && isDropDownOpen)}
        classNames={`h-fit text-white  ${isCollapsed ? "w-52" : "w-40"} `}
        style={{
          position: "fixed",
          left: `${dropDownPosition.x}px`,
          top: `${dropDownPosition.y}px`,
          zIndex: 9999,
        }}
      />
      <Modal />
    </>
  );
};

export default MessageActions;
