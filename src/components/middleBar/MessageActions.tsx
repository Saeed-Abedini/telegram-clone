"use client";

import {
  copyText,
  deleteFile,
  getTimeReportFromDate,
  uploadFile as uploadFileWithRetry,
} from "@/utils";
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
import useGlobalStore, { GlobalStoreProps } from "@/stores/globalStore";
import Image from "next/image";
import Message from "@/models/message";
import ProfileGradients from "../modules/ProfileGradients";
import { formatDateByDistance } from "@/utils/Date/formatDateByDistance";
import { FiSend } from "react-icons/fi";
import { pendingMessagesService } from "@/utils/pendingMessages";
import { msgDataProps } from "./Message";
import { voiceBlobStorage } from "@/utils/voiceBlobStorage";

interface MessageActionsProps {
  isFromMe: boolean;
  msgData: Message & msgDataProps;
}

type PlayedByUsersData = User & { seenTime: string };

const MessageActions = ({ isFromMe, msgData }: MessageActionsProps) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [playedByUsersData, setPlayedByUsersData] = useState<
    PlayedByUsersData[]
  >([]);
  const [dropDownPosition, setDropDownPosition] = useState({ x: 0, y: 0 });
  const [isDropDownOpen, setIsDropDownOpen] = useState(false);

  const { setter: modalSetter, isChecked } = useModalStore((state) => state);
  const { setter, selectedRoom } = useGlobalStore((state) => state);
  const roomSocket = useSockets((state) => state.rooms);
  const myData = useUserStore((state) => state);
  const isUserChannel = selectedRoom?.type === "channel" && !isFromMe;

  const retrySend = useCallback(
    async (msg: Message) => {
      // Mark as pending in UI
      setter(
        (prev): Partial<GlobalStoreProps> => ({
          selectedRoom: prev.selectedRoom
            ? {
                ...prev.selectedRoom,
                messages: prev.selectedRoom.messages.map((m) =>
                  m._id === msg._id ? { ...m, status: "pending" } : m
                ),
              }
            : null,
        })
      );

      // Ensure voice src exists by uploading from IndexedDB if necessary
      let preparedVoiceData = msg.voiceData || null;
      if (
        preparedVoiceData &&
        (!preparedVoiceData.src || !preparedVoiceData.src.trim())
      ) {
        try {
          const blob = await voiceBlobStorage.getBlob(msg.tempId || msg._id);
          if (!blob) {
            // No blob available to upload, keep as failed and abort retry
            setter(
              (prev): Partial<GlobalStoreProps> => ({
                selectedRoom: prev.selectedRoom
                  ? {
                      ...prev.selectedRoom,
                      messages: prev.selectedRoom.messages.map((m) =>
                        m._id === msg._id ? { ...m, status: "failed" } : m
                      ),
                    }
                  : null,
              })
            );
            return;
          }

          const file = new File([blob], `voice-retry-${Date.now()}.ogg`, {
            type: "audio/ogg",
          });

          const uploadResult = await uploadFileWithRetry(file, (progress) => {
            setter(
              (prev): Partial<GlobalStoreProps> => ({
                selectedRoom: prev.selectedRoom
                  ? {
                      ...prev.selectedRoom,
                      messages: prev.selectedRoom.messages.map((m) =>
                        m._id === msg._id
                          ? { ...m, uploadProgress: progress }
                          : m
                      ),
                    }
                  : null,
              })
            );
          });

          if (!uploadResult.success || !uploadResult.downloadUrl) {
            setter(
              (prev): Partial<GlobalStoreProps> => ({
                selectedRoom: prev.selectedRoom
                  ? {
                      ...prev.selectedRoom,
                      messages: prev.selectedRoom.messages.map((m) =>
                        m._id === msg._id ? { ...m, status: "failed" } : m
                      ),
                    }
                  : null,
              })
            );
            return;
          }

          preparedVoiceData = {
            ...preparedVoiceData,
            src: uploadResult.downloadUrl,
          };

          // Update local UI message and pending storage with new src
          setter(
            (prev): Partial<GlobalStoreProps> => ({
              selectedRoom: prev.selectedRoom
                ? {
                    ...prev.selectedRoom,
                    messages: prev.selectedRoom.messages.map((m) =>
                      m._id === msg._id
                        ? {
                            ...m,
                            voiceData: preparedVoiceData,
                            uploadProgress: 100,
                          }
                        : m
                    ),
                  }
                : null,
            })
          );

          const pending = pendingMessagesService.getPendingMessages(msg.roomID);
          const updated = pending.map((m) =>
            m._id === msg._id ? { ...m, voiceData: preparedVoiceData } : m
          );
          pendingMessagesService.savePendingMessages(msg.roomID, updated);
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
        } catch (e: unknown) {
          setter(
            (prev): Partial<GlobalStoreProps> => ({
              selectedRoom: prev.selectedRoom
                ? {
                    ...prev.selectedRoom,
                    messages: prev.selectedRoom.messages.map((m) =>
                      m._id === msg._id ? { ...m, status: "failed" } : m
                    ),
                  }
                : null,
            })
          );
          return;
        }
      }

      const payload = {
        roomID: msg.roomID,
        message: msg.message,
        sender: myData,
        replayData: msg.replayedTo
          ? { targetID: msg.replayedTo.msgID, replayedTo: msg.replayedTo }
          : null,
        voiceData: preparedVoiceData,
        tempId: msg._id,
      };

      const sendWithRetry = (attempts = 0, startTime = Date.now()) => {
        const timeoutId = setTimeout(() => {
          attempts++;
          const elapsed = Date.now() - startTime;
          if (elapsed < 10000) {
            sendWithRetry(attempts, startTime);
          } else {
            setter(
              (prev): Partial<GlobalStoreProps> => ({
                selectedRoom: prev.selectedRoom
                  ? {
                      ...prev.selectedRoom,
                      messages: prev.selectedRoom.messages.map((m) =>
                        m._id === msg._id ? { ...m, status: "failed" } : m
                      ),
                    }
                  : null,
              })
            );
          }
        }, 2000);

        roomSocket?.emit(
          "newMessage",
          payload,
          (response: { success: boolean; _id: string }) => {
            clearTimeout(timeoutId);
            if (response?.success) {
              setter(
                (prev): Partial<GlobalStoreProps> => ({
                  selectedRoom: prev.selectedRoom
                    ? {
                        ...prev.selectedRoom,
                        messages: prev.selectedRoom.messages.map((m) =>
                          m._id === msg._id
                            ? {
                                ...m,
                                _id: response._id,
                                status: "sent",
                                uploadProgress: undefined,
                              }
                            : m
                        ),
                      }
                    : null,
                })
              );
              pendingMessagesService.removePendingMessage(
                payload.roomID,
                msg._id
              );
              // Cleanup saved blob (if any)
              voiceBlobStorage
                .deleteBlob(msg.tempId || msg._id)
                .catch(() => {});
            } else {
              attempts++;
              const elapsed = Date.now() - startTime;
              if (elapsed < 10000) {
                setTimeout(() => sendWithRetry(attempts, startTime), 2000);
              } else {
                setter(
                  (prev): Partial<GlobalStoreProps> => ({
                    selectedRoom: prev.selectedRoom
                      ? {
                          ...prev.selectedRoom,
                          messages: prev.selectedRoom.messages.map((m) =>
                            m._id === msg._id ? { ...m, status: "failed" } : m
                          ),
                        }
                      : null,
                  })
                );
              }
            }
          }
        );
      };

      sendWithRetry();
    },
    [setter, myData, roomSocket]
  );

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

  const retry = useCallback(() => {
    if (msgData) retrySend(msgData);
    onClose();
  }, [msgData, onClose, retrySend]);

  const cancelSending = useCallback(() => {
    if (msgData.tempId) {
      pendingMessagesService.cancelPendingMessage(
        msgData.roomID,
        msgData.tempId
      );
      // Cleanup any stored voice blob for this temp message
      voiceBlobStorage
        .deleteBlob(msgData.tempId || msgData._id)
        .catch(() => {});
      setter((prev) => ({
        selectedRoom: prev.selectedRoom
          ? {
              ...prev.selectedRoom,
              messages: prev.selectedRoom.messages.filter(
                (msg) => msg.tempId !== msgData.tempId
              ),
            }
          : null,
      }));
    }
    onClose();
  }, [msgData, onClose, setter]);

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
          msgData?.sender._id === myData._id &&
          msgData?.seen?.length &&
          msgData?.readTime &&
          !isCollapsed && {
            title: (
              <div className="flex relative justify-between items-center w-full text-xs">
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
              msgData?.status !== "sent" && {
                title: "Cancel sending",
                icon: <AiOutlineDelete className="size-5  text-gray-400 " />,
                onClick: cancelSending,
              },
              msgData?.status === "failed" && {
                title: "Retry",
                icon: <FiSend className="size-5  text-gray-400 " />,
                onClick: retry,
              },
              roomData?.type !== "channel" &&
                msgData?.status === "sent" && {
                  title: "Reply",
                  icon: <GoReply className="size-5  text-gray-400 " />,
                  onClick: actionHandler(msgData?.addReplay),
                },
              (roomData?.type !== "channel" ||
                roomData?.admins?.includes(myData._id)) &&
                msgData?.status === "sent" && {
                  title: msgData?.pinnedAt ? "Unpin" : "Pin",
                  icon: <LuPin className="size-5  text-gray-400 " />,
                  onClick: actionHandler(msgData?.pin),
                },
              {
                title: "Copy",
                icon: <MdContentCopy className="size-5  text-gray-400 " />,
                onClick: copy,
              },
              msgData?.sender._id === myData._id &&
                msgData?.status === "sent" && {
                  title: "Edit",
                  icon: (
                    <MdOutlineModeEdit className="size-5  text-gray-400 " />
                  ),
                  onClick: actionHandler(msgData?.edit),
                },
              (roomData?.type === "private" ||
                msgData?.sender._id === myData._id ||
                roomData?.admins?.includes(myData._id)) &&
                msgData?.status === "sent" && {
                  title: "Delete",
                  icon: <AiOutlineDelete className="size-5  text-gray-400 " />,
                  onClick: deleteMessage,
                },
            ]
          : playedByUsersData.map((user) => ({
              title: (
                <div className="flex w-full justify-between mt-1">
                  <span className="-ml-2">
                    {user?._id == myData._id ? "You" : user?.name}
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
      myData._id,
      playedByUsersData,
      copy,
      deleteMessage,
      actionHandler,
      openProfile,
      isUserChannel,
      retry,
      cancelSending,
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
