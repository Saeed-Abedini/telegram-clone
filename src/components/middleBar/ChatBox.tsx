import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  memo,
  Suspense,
  lazy,
  useLayoutEffect,
} from "react";
import useGlobalStore from "@/stores/globalStore";
import useSockets from "@/stores/useSockets";
import ScrollToBottom from "../modules/ScrollToBottom";
import { IoIosArrowDown } from "react-icons/io";
import useScrollChange from "@/hook/useScrollChange";
import MessageModel from "@/models/message";
import useUserStore from "@/stores/userStore";
import useScrollMessage from "@/hook/chatBox/useScrollMessage";
import useMessages from "@/hook/chatBox/useMessages";
import useTyping from "@/hook/chatBox/useTyping";
import useRoomEvents from "@/hook/chatBox/useRoomEvents";
const PinnedMessages = lazy(
  () => import("@/components/middleBar/PinnedMessages")
);
const MessageList = lazy(() => import("./MessageList"));

interface ChatBoxProps {
  setTypings: React.Dispatch<React.SetStateAction<string[]>>;
  setEditData: React.Dispatch<React.SetStateAction<MessageModel | null>>;
  setReplayData: React.Dispatch<React.SetStateAction<string | null>>;
  pinnedMessages: MessageModel[];
  isLoaded: boolean;
  setIsLoaded: React.Dispatch<React.SetStateAction<boolean>>;
  _id: string;
}

const ChatBox = ({
  setTypings,
  setEditData,
  setReplayData,
  pinnedMessages,
  isLoaded,
  setIsLoaded,
  _id,
}: ChatBoxProps) => {
  const [isLastMsgInView, setIsLastMsgInView] = useState(false);
  const [floatingDate, setFloatingDate] = useState(null);
  const { rooms } = useSockets((state) => state);
  const { selectedRoom, setter } = useGlobalStore((state) => state) || {};
  const { _id: roomID, messages, type } = selectedRoom!;

  const {
    _id: myID,
    name: myName,
    setter: userDataUpdater,
    rooms: userRooms,
    roomMessageTrack,
  } = useUserStore((state) => state);

  const messageContainerRef = useRef<HTMLDivElement | null>(null);
  const lastScrollPos = useRef(0);
  const scrollTimeout = useRef<NodeJS.Timeout | null>(null);
  const ringAudioRef = useRef<HTMLAudioElement>(null);

  const { canShow } = useScrollChange(messageContainerRef?.current);

  const playRingSound = useCallback(() => {
    if (ringAudioRef.current) {
      ringAudioRef.current.currentTime = 0;
      ringAudioRef.current.play();
    }
  }, []);

  useLayoutEffect(() => {
    setter({ isChatPageLoaded: true });
    return () => {
      setIsLoaded(false);
      setTypings([]);

      rooms?.emit("updateLastMsgPos", {
        roomID: _id,
        scrollPos: lastScrollPos.current,
        userID: myID,
      });
    };
  }, [roomID, _id, rooms, myID, setter, setIsLoaded, setTypings]);

  const checkIsLastMsgInView = useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      lastScrollPos.current = e.currentTarget.scrollTop;
      const threshold = 10;
      const isInView =
        e.currentTarget.scrollHeight -
          e.currentTarget.scrollTop -
          e.currentTarget.clientHeight <=
        threshold;
      setIsLastMsgInView(isInView);
    },
    []
  );

  const { lastMsgRef, manageScroll } = useScrollMessage({
    messages: selectedRoom?.messages,
    myID,
    isLastMsgInView,
  });

  useLayoutEffect(() => {
    manageScroll();
  }, [manageScroll]);

  const markAsLoaded = useCallback(() => setIsLoaded(true), [setIsLoaded]);

  useLayoutEffect(() => {
    if (!isLoaded && _id && messages?.length) {
      const lastSeenMsg = [...messages]
        .reverse()
        .find((msg) => msg.sender._id === myID || msg.seen.includes(myID));
      if (lastSeenMsg) {
        const lastSeenMsgElem = document.getElementsByClassName(
          lastSeenMsg._id
        )[0];
        if (lastSeenMsgElem) {
          lastSeenMsgElem.scrollIntoView({
            behavior: "smooth",
            block: "start",
          });
          markAsLoaded();
        }
      }
    }
  }, [messages, isLoaded, myID, _id, markAsLoaded]);

  useLayoutEffect(() => {
    const track = roomMessageTrack?.find((track) => track.roomId === _id);

    if (track && messageContainerRef.current) {
      // Use MutationObserver to ensure scroll position is set after content loads
      if (
        messageContainerRef.current &&
        messageContainerRef.current.scrollHeight > 0
      ) {
        messageContainerRef.current.scrollTop = track.scrollPos;
      }
    }
  }, [_id, roomMessageTrack]);

  useLayoutEffect(() => {
    const handleBeforeUnload = () => {
      rooms?.emit("updateLastMsgPos", {
        roomID,
        scrollPos: lastScrollPos.current,
        userID: myID,
        shouldEmitBack: false,
      });
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [myID, roomID, rooms]);

  useMessages({ rooms, roomID, myID, setter, playRingSound });
  useTyping({ rooms, roomID, myName, setTypings });
  useRoomEvents({
    rooms,
    selectedRoom,
    setter,
    myID,
    userDataUpdater,
    userRooms,
  });

  const pinMessage = useCallback(
    (id: string) => {
      const isLastMessage = messages?.at(-1)?._id === id;
      rooms?.emit("pinMessage", id, selectedRoom?._id, isLastMessage);
    },
    [messages, rooms, selectedRoom]
  );

  const notSeenMessages = useMemo(() => {
    let count = 0;
    if (messages?.length) {
      const msgs = messages.filter(
        (msg) => msg.sender?._id !== myID && !msg.seen?.includes(myID)
      );
      count = msgs.length;
    }
    return count;
  }, [messages, myID]);

  const scrollToBottom = useCallback(() => {
    lastMsgRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }, [lastMsgRef]);

  // Handle floating date
  useEffect(() => {
    const container = messageContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      if (scrollTimeout.current) clearTimeout(scrollTimeout.current);

      const containerTop = container.getBoundingClientRect().top;
      const stickyEls = container.querySelectorAll("[data-date]");
      let currentDate = null;
      // We check the date elements from top to bottom (or in the order they are placed in the DOM)
      stickyEls.forEach((el) => {
        const rect = el.getBoundingClientRect();
        // If the element reaches (or passes) the top of the container, currentDate is updated.
        if (rect.top - containerTop <= 0) {
          currentDate = el.getAttribute("data-date");
        }
      });
      setFloatingDate(currentDate);

      scrollTimeout.current = setTimeout(() => {
        setFloatingDate(null);
      }, 2000);
    };

    container.addEventListener("scroll", handleScroll);
    return () => container.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <>
      <Suspense>
        <PinnedMessages
          key={roomID}
          pinnedMessages={pinnedMessages}
          messageContainerRef={messageContainerRef}
        />
      </Suspense>

      <div
        onScroll={checkIsLastMsgInView}
        ref={messageContainerRef}
        id="chatContainer"
        className={`mt-auto px-0.5 pb-1 overflow-x-hidden overflow-y-auto scroll-w-none`}
      >
        <div
          onClick={() => {
            const target = messageContainerRef.current?.querySelector(
              `[data-date="${floatingDate}"]`
            );
            if (target) {
              target.scrollIntoView({
                behavior: "smooth",
                block: "start",
              });
            }
          }}
          className={`absolute left-1/2 mx-auto -translate-x-1/2 bg-gray-800 text-white text-xs py-1 px-3 rounded-2xl cursor-pointer transition-all duration-300 z-5 transform  ${
            floatingDate ? "translate-y-1.5" : "-translate-y-5 !p-0"
          }`}
        >
          {floatingDate}
        </div>

        {/* <Suspense> */}
        <MessageList
          messages={messages}
          myID={myID}
          type={type}
          lastMsgRef={lastMsgRef}
          setEditData={setEditData}
          setReplayData={setReplayData}
          pinMessage={pinMessage}
        />
        {/* </Suspense> */}

        <ScrollToBottom
          count={notSeenMessages}
          scrollToBottom={scrollToBottom}
        />

        <div
          onClick={() =>
            messageContainerRef.current?.scrollTo({
              top: messageContainerRef.current.scrollHeight,
              behavior: "smooth",
            })
          }
          className={`${
            !notSeenMessages && canShow && !isLastMsgInView
              ? "right-1.5"
              : "-right-12"
          } transition-all duration-300 size-10 absolute bottom-25 bg-[#2E323F] cursor-pointer rounded-full flex items-center justify-center`}
        >
          <IoIosArrowDown className="size-5 text-white" />
        </div>
        <audio
          ref={ringAudioRef}
          className="hidden invisible opacity-0"
          src="/files/sfx.mp3"
          controls={false}
        ></audio>
      </div>
    </>
  );
};

export default memo(ChatBox);
