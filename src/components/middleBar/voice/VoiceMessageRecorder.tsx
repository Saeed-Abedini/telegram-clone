"use client";

import Message from "@/models/message";
import useGlobalStore, { GlobalStoreProps } from "@/stores/globalStore";
import useUserStore from "@/stores/userStore";
import useSockets from "@/stores/useSockets";
import { pendingMessagesService } from "@/utils/pendingMessages";
import {
  secondsToTimeString,
  toaster,
  uploadFile as uploadFileWithRetry,
} from "@/utils";
import { useState, useRef, useEffect, useCallback } from "react";
import { PiMicrophoneLight } from "react-icons/pi";
import Loading from "../../modules/ui/Loading";
import { RiSendPlaneFill } from "react-icons/ri";
import { v4 as uuidv4 } from "uuid";
import { voiceBlobStorage } from "@/utils/voiceBlobStorage";

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
  const selectedRoom = useGlobalStore((state) => state.selectedRoom);
  const myData = useUserStore((state) => state);
  const setter = useGlobalStore((state) => state.setter);
  const { rooms } = useSockets((state) => state);
  const [isRecording, setIsRecording] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [audioURL, setAudioURL] = useState("");
  const [timer, setTimer] = useState(0);
  const [voiceBlob, setVoiceBlob] = useState<Blob | null>(null);
  const [pendingMessageId, setPendingMessageId] = useState<string | null>(null);

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
              message: replayData.message || "",
              msgID: replayData._id || "",
              username: replayData.sender?.name || "",
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

  // Create pending message and return its ID
  const createPendingMessage = useCallback(
    (
      voiceData: { src: string; duration: number; playedBy: string[] },
      tempId: string,
      rawBlob?: Blob
    ) => {
      const localMessage = {
        _id: tempId,
        message: "",
        sender: myData,
        isEdited: false,
        seen: [],
        readTime: null,
        replays: [],
        pinnedAt: null,
        playedBy: null,
        hideFor: [],
        updatedAt: new Date().toISOString(),
        roomID: selectedRoom?._id || "",
        status: "pending" as const,
        voiceData,
        replayedTo: formattedReplayData()
          ? formattedReplayData()!.replayedTo
          : null,
        createdAt: new Date().toISOString(),
        uploadProgress: 0,
        tempId,
      };

      setter(
        (prev: GlobalStoreProps): Partial<GlobalStoreProps> => ({
          selectedRoom: prev.selectedRoom
            ? {
                ...prev.selectedRoom,
                messages: [
                  ...(prev.selectedRoom?.messages ?? []),
                  localMessage,
                ] as Message[],
              }
            : null,
        })
      );

      pendingMessagesService.addPendingMessage(
        selectedRoom?._id || "",
        localMessage
      );
      // Save blob to IndexedDB when offline OR when message might fail
      const blobToSave = rawBlob || voiceBlob;
      if (blobToSave && typeof navigator !== "undefined") {
        // Always save blob to IndexedDB for potential retry scenarios
        voiceBlobStorage
          .saveBlob(localMessage._id, blobToSave)
          .catch((error) =>
            console.error("Failed to save voice blob to IndexedDB:", error)
          );
      }
      return tempId;
    },
    [myData, selectedRoom?._id, formattedReplayData, setter, voiceBlob]
  );

  // Send message with retry logic
  const sendWithRetry = useCallback(
    (
      payload: {
        roomID: string | undefined;
        message: string;
        sender: typeof myData;
        replayData: {
          targetID: string;
          replayedTo: {
            message: string;
            msgID: string;
            username: string | undefined;
          };
        } | null;
        voiceData: {
          src: string;
          duration: number;
          playedBy: string[];
        };
        tempId: string;
      },
      tempId: string,
      startTime: number = Date.now(),
      attempts: number = 0
    ) => {
      rooms?.emit(
        "newMessage",
        payload,
        (response: { success: boolean; _id: string }) => {
          if (response?.success) {
            setter(
              (prev: GlobalStoreProps): Partial<GlobalStoreProps> => ({
                selectedRoom: prev.selectedRoom
                  ? {
                      ...prev.selectedRoom,
                      messages: prev.selectedRoom.messages.map((msg) =>
                        msg._id === tempId
                          ? { ...msg, _id: response._id, status: "sent" }
                          : msg
                      ),
                    }
                  : null,
              })
            );
            pendingMessagesService.removePendingMessage(
              payload.roomID || "",
              tempId
            );
            // Cleanup any stored blob for this temp message (defensive)
            voiceBlobStorage.deleteBlob(tempId).catch(() => {});
            setPendingMessageId(null);
            stopRecording();
          } else {
            attempts++;
            const elapsed = Date.now() - startTime;
            if (elapsed < 30000) {
              setTimeout(
                () => sendWithRetry(payload, tempId, startTime, attempts),
                2000
              );
            } else {
              toaster(
                "error",
                "Failed to send voice message after multiple retries."
              );
              setter(
                (prev: GlobalStoreProps): Partial<GlobalStoreProps> => ({
                  selectedRoom: prev.selectedRoom
                    ? {
                        ...prev.selectedRoom,
                        messages: prev.selectedRoom.messages.map((msg) =>
                          msg._id === tempId
                            ? { ...msg, status: "failed" }
                            : msg
                        ),
                      }
                    : null,
                })
              );
              // Persist blob for manual retry if not already saved
              if (voiceBlob) {
                voiceBlobStorage
                  .saveBlob(tempId, voiceBlob)
                  .catch((error) =>
                    console.error("Failed to save voice blob for retry:", error)
                  );
              }
              setPendingMessageId(null);
              stopRecording();
            }
          }
        }
      );
    },
    [rooms, setter, stopRecording, voiceBlob]
  );

  const sendVoiceMessage = useCallback(
    (voiceSrc: string, voiceDuration: number, tempId: string) => {
      const voiceData = {
        src: voiceSrc,
        duration: voiceDuration,
        playedBy: [],
      };

      const payload = {
        roomID: selectedRoom?._id,
        message: "",
        sender: myData,
        replayData: formattedReplayData(),
        voiceData,
        tempId,
      };

      sendWithRetry(
        {
          ...payload,
          replayData: payload.replayData
            ? {
                targetID: payload.replayData.targetID!,
                replayedTo: {
                  message: payload.replayData.replayedTo.message!,
                  msgID: payload.replayData.replayedTo.msgID!,
                  username: payload.replayData.replayedTo.username,
                },
              }
            : null,
        },
        tempId
      );
      closeEdit();
      closeReplay();
    },
    [
      closeEdit,
      closeReplay,
      formattedReplayData,
      sendWithRetry,
      selectedRoom,
      myData,
    ]
  );

  const uploadVoice = useCallback(
    async (voiceFile: File, rawBlob?: Blob) => {
      try {
        setIsLoading(true);
        const tempId = uuidv4();

        // Do not persist to IndexedDB when online; we'll save only on offline or failure

        // Create pending message immediately
        const voiceData = {
          src: "", // Will be updated after upload
          duration: timerRef.current,
          playedBy: [],
        };

        createPendingMessage(voiceData, tempId, rawBlob);
        setPendingMessageId(tempId);

        // Start upload with progress tracking
        const startTime = Date.now();
        const minUploadTime = 2000; // Minimum 2 seconds to show progress

        const uploadResult = await uploadFileWithRetry(
          voiceFile,
          (progress) => {
            // Ensure progress is visible for at least 2 seconds minimum
            const elapsedTime = Date.now() - startTime;
            const adjustedProgress = Math.min(progress, 95);

            // If upload is too fast, artificially slow it down
            if (elapsedTime < minUploadTime && progress < 100) {
              const slowProgress = Math.min(
                adjustedProgress,
                (elapsedTime / minUploadTime) * 95
              );
              // Update message in store with progress
              setter(
                (prev: GlobalStoreProps): Partial<GlobalStoreProps> => ({
                  selectedRoom: prev.selectedRoom
                    ? {
                        ...prev.selectedRoom,
                        messages: prev.selectedRoom.messages.map((msg) =>
                          msg._id === tempId
                            ? { ...msg, uploadProgress: slowProgress }
                            : msg
                        ),
                      }
                    : null,
                })
              );
            } else {
              // Update message in store with progress
              setter(
                (prev: GlobalStoreProps): Partial<GlobalStoreProps> => ({
                  selectedRoom: prev.selectedRoom
                    ? {
                        ...prev.selectedRoom,
                        messages: prev.selectedRoom.messages.map((msg) =>
                          msg._id === tempId
                            ? { ...msg, uploadProgress: adjustedProgress }
                            : msg
                        ),
                      }
                    : null,
                })
              );
            }
          }
        );

        // Ensure minimum upload time is respected
        const elapsedTime = Date.now() - startTime;
        const remainingTime = Math.max(0, minUploadTime - elapsedTime);

        // Animate progress to 100%
        const finalProgressAnimation = async () => {
          setter(
            (prev: GlobalStoreProps): Partial<GlobalStoreProps> => ({
              selectedRoom: prev.selectedRoom
                ? {
                    ...prev.selectedRoom,
                    messages: prev.selectedRoom.messages.map((msg) =>
                      msg._id === tempId ? { ...msg, uploadProgress: 100 } : msg
                    ),
                  }
                : null,
            })
          );
        };

        if (remainingTime > 0) {
          await new Promise((resolve) => setTimeout(resolve, remainingTime));
          await finalProgressAnimation();
          await new Promise((resolve) => setTimeout(resolve, 300)); // Brief pause at 100%
        } else {
          await finalProgressAnimation();
          await new Promise((resolve) => setTimeout(resolve, 500)); // Brief pause at 100%
        }

        if (uploadResult.success) {
          sendVoiceMessage(uploadResult.downloadUrl!, timerRef.current, tempId);
        } else {
          toaster(
            "error",
            uploadResult.error || "Failed to upload voice message."
          );
          setter(
            (prev: GlobalStoreProps): Partial<GlobalStoreProps> => ({
              selectedRoom: prev.selectedRoom
                ? {
                    ...prev.selectedRoom,
                    messages: prev.selectedRoom.messages.map((msg) =>
                      msg._id === tempId ? { ...msg, status: "failed" } : msg
                    ),
                  }
                : null,
            })
          );
          // Persist raw blob for later retry on upload failure
          const blobForSave = rawBlob || voiceBlob;
          if (blobForSave) {
            try {
              await voiceBlobStorage.saveBlob(tempId, blobForSave);
            } catch {}
          }
          setPendingMessageId(null);
          stopRecording();
        }
      } catch (error) {
        console.error("Upload failed:", error);
        toaster("error", "Upload failed! Please try again.");
        if (pendingMessageId) {
          setter(
            (prev: GlobalStoreProps): Partial<GlobalStoreProps> => ({
              selectedRoom: prev.selectedRoom
                ? {
                    ...prev.selectedRoom,
                    messages: prev.selectedRoom.messages.map((msg) =>
                      msg._id === pendingMessageId
                        ? { ...msg, status: "failed" }
                        : msg
                    ),
                  }
                : null,
            })
          );
          // Persist blob on unexpected error, too
          if (voiceBlob) {
            voiceBlobStorage
              .saveBlob(pendingMessageId, voiceBlob)
              .catch(() => {});
          }
          setPendingMessageId(null);
        }
      } finally {
        setIsLoading(false);
      }
    },
    [
      createPendingMessage,
      setter,
      sendVoiceMessage,
      voiceBlob,
      stopRecording,
      pendingMessageId,
    ]
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
          setVoiceBlob(audioBlob);
          await uploadVoice(file, audioBlob);
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
