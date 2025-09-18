"use client";

import useGlobalStore from "@/stores/globalStore";
import useUserStore from "@/stores/userStore";
import useSockets from "@/stores/useSockets";
import React, {
  lazy,
  useEffect,
  useMemo,
  useState,
  useCallback,
  useRef,
  Suspense,
} from "react";
import { BiSearch } from "react-icons/bi";
import { RxHamburgerMenu } from "react-icons/rx";

import ChatCard from "./ChatCard";
import RoomSkeleton from "../modules/ui/RoomSkeleton";
import RoomFolders from "./RoomFolders";
import useConnection from "@/hook/useConnection";
import Message from "@/models/message";
import NotificationPermission from "@/utils/NotificationPermission";

const CreateRoomBtn = lazy(() => import("@/components/leftBar/CreateRoomBtn"));
const LeftBarMenu = lazy(() => import("@/components/leftBar/menu/LeftBarMenu"));
const SearchPage = lazy(() => import("@/components/leftBar/SearchPage"));
const CreateRoom = lazy(() => import("@/components/leftBar/CreateRoom"));

const LeftBar = () => {
  const [filterBy, setFilterBy] = useState("all");
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isLeftBarMenuOpen, setIsLeftBarMenuOpen] = useState(false);
  const [leftBarActiveRoute, setLeftBarActiveRoute] = useState("/");
  const ringAudioRef = useRef<HTMLAudioElement>(null);

  const userId = useUserStore((state) => state._id);
  const { updater, rooms: roomsSocket } = useSockets((state) => state);
  const { setter: userDataUpdater, rooms: userRooms } = useUserStore(
    (state) => state
  );

  const {
    selectedRoom,
    setter,
    isRoomDetailsShown,
    createRoomType,
    showCreateRoomBtn,
  } = useGlobalStore((state) => state);
  const interactUser = useRef(false);

  useEffect(() => {
    NotificationPermission();
    const handleContextMenu = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target?.tagName === "TEXTAREA" || target?.tagName === "INPUT") {
        return;
      }
      e.preventDefault();
    };
    document.addEventListener("contextmenu", handleContextMenu);
    return () => {
      document.removeEventListener("contextmenu", handleContextMenu);
    };
  }, []);

  useEffect(() => {
    document.addEventListener("click", () => (interactUser.current = true));

    return () => {
      document.addEventListener("click", () => (interactUser.current = true));
    };
  }, []);

  const playRingSound = useCallback(() => {
    if (ringAudioRef.current && interactUser.current) {
      ringAudioRef.current.currentTime = 0;
      ringAudioRef.current.play();
    }
  }, []);

  useEffect(() => {
    const handleNewMessage = async (newMsg: Message) => {
      if (newMsg.roomID !== selectedRoom?._id || !selectedRoom?._id) {
        if (document.visibilityState !== "visible") {
          if (
            "serviceWorker" in navigator &&
            Notification.permission === "granted"
          ) {
            const registration = await navigator.serviceWorker.ready;
            registration.showNotification(newMsg.sender.name || "", {
              body: newMsg.message || "",
              icon: newMsg.sender.avatar || "/images/favicon.svg",
              data: { url: window.location.href },
              dir: "auto",
              badge: "/images/favicon-96x96.png",
              silent: true,
            });
          }
        }
        playRingSound();
      }
    };

    roomsSocket?.on("newMessage", handleNewMessage);

    return () => {
      roomsSocket?.off("newMessage", handleNewMessage);
    };
  }, [playRingSound, roomsSocket, selectedRoom]);

  const { status, isPageLoaded } = useConnection({
    selectedRoom,
    setter,
    userId,
    userDataUpdater,
    updater,
  });

  //Sort rooms by filter and last message time
  const sortedRooms = useMemo(() => {
    const filteredRooms =
      filterBy === "all"
        ? userRooms
        : userRooms.filter((room) => room.type === filterBy);

    return filteredRooms.sort((a, b) => {
      const aTime = a?.lastMsgData?.createdAt
        ? new Date(a.lastMsgData.createdAt).getTime()
        : 0;
      const bTime = b?.lastMsgData?.createdAt
        ? new Date(b.lastMsgData.createdAt).getTime()
        : 0;
      return bTime - aTime;
    });
  }, [userRooms, filterBy]);

  const handleOpenLeftBarMenu = useCallback(() => {
    setIsLeftBarMenuOpen(true);
  }, []);

  const handleCloseLeftBarMenu = useCallback(() => {
    setIsLeftBarMenuOpen(false);
  }, []);

  const handleOpenSearch = useCallback(() => {
    setIsSearchOpen(true);
  }, []);

  const handleCloseSearch = useCallback(() => {
    setIsSearchOpen(false);
  }, []);

  const containerClassName = useMemo(() => {
    return `size-full h-dvh ${
      selectedRoom ? "hidden" : ""
    } md:block md:w-[40%] lg:w-[35%] ${
      isRoomDetailsShown ? "xl:w-[25%]" : "xl:w-[30%]"
    } relative border-r border-chatBg/[50%]`;
  }, [selectedRoom, isRoomDetailsShown]);

  return (
    <>
      <div className={containerClassName}>
        <LeftBarMenu
          isOpen={isLeftBarMenuOpen}
          closeMenu={handleCloseLeftBarMenu}
          onRouteChanged={setLeftBarActiveRoute}
        />
        {createRoomType && (
          <Suspense>
            <CreateRoom />
          </Suspense>
        )}
        {isPageLoaded && showCreateRoomBtn && <CreateRoomBtn />}
        {isSearchOpen && <SearchPage closeSearch={handleCloseSearch} />}

        {leftBarActiveRoute !== "/settings" && (
          <div
            data-aos-duration="400"
            data-aos="fade-right"
            id="leftBar-container"
            className="flex-1 bg-leftBarBg h-full relative scroll-w-none overflow-y-auto "
          >
            <div
              className="w-full sticky top-0 bg-leftBarBg border-b border-white/5 h-20 overflow-hidden"
              style={{ zIndex: 1 }}
            >
              <div className="flex items-center justify-between gap-6 mx-3">
                <div className="flex items-center flex-1 gap-5 mt-3 w-full text-white">
                  <RxHamburgerMenu
                    size={20}
                    onClick={handleOpenLeftBarMenu}
                    className="cursor-pointer"
                  />
                  <h1 className="font-vazirBold mt-0.5">{status}</h1>
                </div>
                <BiSearch
                  size={22}
                  onClick={handleOpenSearch}
                  className="cursor-pointer text-white/90 mt-3"
                />
              </div>
              <RoomFolders updateFilterBy={setFilterBy} />
            </div>

            <div
              className="flex flex-col overflow-y-auto overflow-x-hidden scroll-w-none w-full"
              style={{ zIndex: 0 }}
            >
              {isPageLoaded ? (
                sortedRooms.length ? (
                  sortedRooms.map((data) => (
                    <ChatCard {...data} key={data?._id} />
                  ))
                ) : (
                  <div className="text-xl text-white font-bold w-full text-center font-vazirBold pt-20">
                    No chats found
                  </div>
                )
              ) : (
                <RoomSkeleton />
              )}
            </div>
          </div>
        )}
        <audio
          ref={ringAudioRef}
          className="hidden invisible opacity-0"
          src="/files/new_msg.mp3"
        ></audio>
      </div>
    </>
  );
};

export default LeftBar;
