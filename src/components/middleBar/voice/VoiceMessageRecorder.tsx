import Message from "@/models/message";
import useGlobalStore from "@/stores/globalStore";
import useUserStore from "@/stores/userStore";
import useSockets from "@/stores/useSockets";
import { secondsToTimeString, toaster, uploadFile } from "@/utils";
import { useState, useRef, useEffect, useCallback } from "react";
import { PiMicrophoneLight } from "react-icons/pi";
import Loading from "../../modules/ui/Loading";
import { RiSendPlaneFill } from "react-icons/ri";

interface Props {
  replayData: Partial<Message> | undefined;
  closeEdit: () => void;
  closeReplay: () => void;
}

const VoiceMessageRecorder = ({
  replayData,
  closeEdit,
  closeReplay,
}: Props) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [audioURL, setAudioURL] = useState("");
  const [timer, setTimer] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef(timer);
  const isCancelledRef = useRef(false);

  const stopStream = useCallback((stream: MediaStream) => {
    stream.getTracks().forEach((track) => track.stop());
  }, []);

  const cancelRecording = useCallback(() => {
    try {
      if (mediaRecorderRef.current) {
        const stream = mediaRecorderRef.current.stream;
        if (stream) stopStream(stream);
        mediaRecorderRef.current = null;
      }
    } catch (error) {
      console.error("Error canceling recording:", error);
    } finally {
      setIsRecording(false);
      isCancelledRef.current = true;
      setIsLoading(false);
      setTimer(0);
    }
  }, [stopStream]);

  useEffect(() => {
    if (!isRecording || isLoading) return setTimer(0);

    const interval = setInterval(() => {
      setTimer((prev) => {
        timerRef.current = prev + 1;
        return prev + 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isRecording, isLoading]);

  const formattedReplayData = useCallback(
    () =>
      replayData
        ? {
            targetID: replayData._id,
            replayedTo: {
              message: replayData.message,
              msgID: replayData._id,
              username: replayData.sender?.name,
            },
          }
        : null,
    [replayData]
  );

  const stopRecording = useCallback(() => {
    try {
      if (mediaRecorderRef.current) {
        mediaRecorderRef.current.stop();
        const stream = mediaRecorderRef.current.stream;
        if (stream) stopStream(stream);
        mediaRecorderRef.current = null;
      }
    } catch (error) {
      console.error("Error stopping recording:", error);
    } finally {
      setIsRecording(false);
      setIsLoading(false);
      setTimer(0);
    }
  }, [stopStream]);

  const sendVoiceMessage = useCallback(
    (voiceSrc: string, voiceDuration: number) => {
      const socket = useSockets.getState().rooms;
      const myData = useUserStore.getState();
      const selectedRoom = useGlobalStore.getState().selectedRoom;

      const voiceData = {
        src: voiceSrc,
        duration: voiceDuration,
        playedBy: [],
      };

      socket?.emit("newMessage", {
        roomID: selectedRoom?._id,
        message: "",
        sender: myData,
        replayData: formattedReplayData,
        voiceData,
      });

      socket?.on("newMessage", stopRecording);
      closeEdit();
      closeReplay();
    },
    [closeEdit, closeReplay, formattedReplayData, stopRecording]
  );
  const uploadVoice = useCallback(
    async (voiceFile: File) => {
      try {
        setIsLoading(true);
        const downloadUrl = await uploadFile(voiceFile);

        if (downloadUrl) {
          sendVoiceMessage(downloadUrl, timerRef.current);
        }
      } catch (error) {
        console.error("Upload failed:", error);
        toaster("error", "Upload failed! Please try again.");
        stopRecording();
      }
    },
    [sendVoiceMessage, stopRecording]
  );

  const startRecording = useCallback(async () => {
    if (!navigator.mediaDevices) {
      return toaster("error", "Your browser does not support voice recording!");
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];
      isCancelledRef.current = false;

      recorder.ondataavailable = (event: BlobEvent) => {
        audioChunksRef.current.push(event.data);
      };

      recorder.onstop = async () => {
        if (isCancelledRef.current) return;

        if (audioChunksRef.current.length) {
          const audioBlob = new Blob(audioChunksRef.current, {
            type: "audio/ogg",
          });
          const url = URL.createObjectURL(audioBlob);
          const file = new File(
            [audioBlob],
            `voice-message-${Date.now()}.ogg`,
            {
              type: "audio/ogg",
            }
          );

          setAudioURL(url);
          await uploadVoice(file);
        }
        audioChunksRef.current = [];
      };

      recorder.start();
      setIsRecording(true);
    } catch (error) {
      console.error(error);
      toaster(
        "error",
        "Microphone access denied! Please allow microphone permissions."
      );
    }
  }, [uploadVoice]);

  return (
    <div className="max-w-fit size-6 z-10">
      <PiMicrophoneLight
        data-aos="zoom-in"
        onClick={startRecording}
        className="size-6 cursor-pointer"
      />

      {isRecording && (
        <div className="flex items-center justify-between pl-2 absolute inset-0 z-20 size-full bg-leftBarBg">
          <div className="flex items-center gap-2 w-18">
            <div className="size-4 rounded-full bg-red-400 animate-pulse flex-center mb-0.5">
              <div className="size-3 rounded-full bg-red-400 border-3 border-leftBarBg"></div>
            </div>
            <p>{secondsToTimeString(timer)}</p>
          </div>

          <button
            onClick={cancelRecording}
            className="px-5 py-3 text-sm bg-transparent font-vazirBold cursor-pointer text-red-500"
          >
            CANCEL
          </button>

          {isLoading ? (
            <span className="w-18 text-right">
              <Loading size="md" />
            </span>
          ) : (
            <span
              className="bg-lightBlue h-full w-12 flex-center rounded-tl-4xl rounded-bl-4xl cursor-pointer "
              onClick={stopRecording}
            >
              <RiSendPlaneFill
                data-aos="zoom-in"
                className=" rounded-sm animate-pulse size-7 rotate-45"
              />
            </span>
          )}
        </div>
      )}

      {audioURL && <audio className="hidden" controls src={audioURL} />}
    </div>
  );
};

export default VoiceMessageRecorder;
