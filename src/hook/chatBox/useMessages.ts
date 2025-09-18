import Message from "@/models/message";
import { GlobalStoreProps } from "@/stores/globalStore";
import { useEffect } from "react";
import { DefaultEventsMap } from "socket.io";
import { Socket } from "socket.io-client";

interface useMessagesProps {
  rooms: Socket<DefaultEventsMap, DefaultEventsMap> | null;
  roomID: string;
  myID: string;
  setter: (
    state:
      | Partial<GlobalStoreProps>
      | ((prev: GlobalStoreProps) => Partial<GlobalStoreProps>)
  ) => void;
  playRingSound: () => void;
}

const useMessages = ({
  rooms,
  roomID,
  myID,
  setter,
  playRingSound,
}: useMessagesProps) => {
  useEffect(() => {
    const handleNewMessage = (newMsg: Message) => {
      if (newMsg.roomID === roomID) {
        playRingSound();
        setter((prev) => ({
          selectedRoom: {
            ...prev.selectedRoom!,
            messages: [...(prev.selectedRoom?.messages ?? []), newMsg],
          },
        }));
      }
    };

    const handleDeleteMsg = (msgID: string) => {
      setter((prev) => {
        const updatedMessages = (prev.selectedRoom?.messages || []).filter(
          (msg) => msg._id !== msgID
        );
        return {
          selectedRoom: {
            ...prev.selectedRoom!,
            messages: updatedMessages,
          },
        };
      });
    };

    const handleEditMessage = ({
      msgID,
      editedMsg,
    }: {
      msgID: string;
      editedMsg: string;
    }) => {
      setter((prev) => ({
        selectedRoom: {
          ...prev.selectedRoom!,
          messages: (prev.selectedRoom?.messages || []).map((msg) =>
            msg._id === msgID
              ? { ...msg, message: editedMsg, isEdited: true }
              : msg
          ),
        },
      }));
    };

    const handleNewMessageIdUpdate = ({
      tempID,
      _id,
    }: {
      tempID: string;
      _id: string;
    }) => {
      playRingSound();
      setter((prev) => ({
        selectedRoom: {
          ...prev.selectedRoom!,
          messages: (prev.selectedRoom?.messages || []).map((msg) =>
            msg._id === tempID ? { ...msg, _id } : msg
          ),
        },
      }));
    };

    const handleSeenMsg = ({
      msgID,
      seenBy,
      readTime,
    }: {
      msgID: string;
      seenBy: string;
      readTime: Date;
    }) => {
      setter(
        (prev): Partial<GlobalStoreProps> => ({
          selectedRoom: prev.selectedRoom
            ? {
                ...(prev.selectedRoom ?? {}),
                messages: (prev.selectedRoom?.messages ?? []).map(
                  (msg: Message) =>
                    msg._id === msgID
                      ? {
                          ...msg,
                          seen: [...new Set([...msg.seen, seenBy])],
                          readTime,
                        }
                      : msg
                ),
              }
            : null,
        })
      );
    };

    rooms?.on("newMessage", handleNewMessage);
    rooms?.on("deleteMsg", handleDeleteMsg);
    rooms?.on("editMessage", handleEditMessage);
    rooms?.on("newMessageIdUpdate", handleNewMessageIdUpdate);
    rooms?.on("seenMsg", handleSeenMsg);

    return () => {
      rooms?.off("newMessage", handleNewMessage);
      rooms?.off("deleteMsg", handleDeleteMsg);
      rooms?.off("editMessage", handleEditMessage);
      rooms?.off("newMessageIdUpdate", handleNewMessageIdUpdate);
      rooms?.off("seenMsg", handleSeenMsg);
    };
  }, [rooms, roomID, myID, setter, playRingSound]);
};
export default useMessages;
