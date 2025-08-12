"use client";
import useGlobalStore from "@/stores/globalStore";
import { lazy, Suspense } from "react";
import Loading from "../modules/ui/Loading";
import AudioManager from "./voice/AudioManager";

const ChatPage = lazy(() => import("./ChatPage"));

const MiddleBar = () => {
  const { selectedRoom, isRoomDetailsShown } = useGlobalStore((state) => state);

  return (
    <div
      className={` chatBackground relative ${
        !selectedRoom && "hidden"
      }  md:block md:w-[60%] lg:w-[65%] ${
        isRoomDetailsShown ? "xl:w-[50%]" : "xl:w-[70%]"
      }   text-white overflow-x-hidden  scroll-w-none size-full `}
    >
      <AudioManager />
      {selectedRoom !== null ? (
        <Suspense
          fallback={
            <div className="size-full h-screen flex-center">
              <Loading size="xl" />
            </div>
          }
        >
          <ChatPage />
        </Suspense>
      ) : (
        <div className="size-full min-h-dvh"></div>
      )}
    </div>
  );
};

export default MiddleBar;
