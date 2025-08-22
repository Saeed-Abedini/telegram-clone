import { memo, useMemo } from "react";
import useAudio from "@/stores/audioStore";
import useSockets from "@/stores/useSockets";
import { FaPlay } from "react-icons/fa";
import { FaPause, FaArrowDown } from "react-icons/fa6";
import { IoClose } from "react-icons/io5";
import Loading from "../../modules/ui/Loading";
import MessageModel from "@/models/message";
import Voice from "@/models/voice";
import AudioWaveDisplay from "./AudioWaveDisplay";
import CircularProgress from "../../modules/ui/CircularProgress";

interface VoiceMessagePlayerProps {
  _id: string;
  voiceDataProp: Voice | null | undefined;
  msgData: MessageModel;
  isFromMe: boolean;
  myId: string;
  roomID: string;
}

const VoiceMessagePlayer = memo(
  ({
    _id,
    voiceDataProp,
    msgData,
    isFromMe,
    myId,
    roomID,
  }: VoiceMessagePlayerProps) => {
    const isPlaying = useAudio((state) => state.isPlaying);
    const voiceData = useAudio((state) => state.voiceData);
    const audioUpdater = useAudio((state) => state.setter);
    const setVoiceDataAndPlay = useAudio((state) => state.setVoiceDataAndPlay);
    const toggleAudioPlayback = useAudio((state) => state.toggleAudioPlayback);
    const downloadedAudios = useAudio((state) => state.downloadedAudios);

    // Handler for playing/pausing audio
    const togglePlayVoice = () => {
      // Don't allow playback if voice is still uploading
      if (msgData.status === "pending" && !voiceDataProp?.src) {
        return;
      }

      if (!isFromMe && !voiceDataProp?.playedBy?.includes(myId)) {
        const socket = useSockets.getState().rooms;
        socket?.emit("listenToVoice", { userID: myId, voiceID: _id, roomID });
      }

      const savedVoiceData = downloadedAudios.find(
        (voice) => voice._id === _id
      );

      if (!savedVoiceData) {
        audioUpdater({
          isPlaying: false,
          voiceData: { ...voiceDataProp!, ...msgData },
          downloadedAudios: [
            ...downloadedAudios,
            { _id, isDownloading: true, downloaded: false },
          ],
        });
        return;
      }

      if (savedVoiceData.isDownloading) {
        audioUpdater({
          isPlaying: false,
          voiceData: null,
          downloadedAudios: downloadedAudios.filter(
            (audio) => audio._id !== _id
          ),
        });
        return;
      }

      if (savedVoiceData.downloaded) {
        if (voiceData?._id === _id) {
          toggleAudioPlayback();
        } else {
          if (voiceData && isPlaying) {
            const audioElem = useAudio.getState().audioElem;
            if (audioElem) {
              audioElem.pause();
              audioElem.currentTime = 0;
            }
            audioUpdater({ isPlaying: false }); // Explicitly stop current playback
          }
          setVoiceDataAndPlay({ ...voiceDataProp!, ...msgData });
        }
        return;
      }
    };

    const getAudioDownloadStatus = (
      downloadedAudios: {
        _id: string;
        isDownloading?: boolean;
        downloaded?: boolean;
      }[],
      _id: string
    ) => {
      return {
        isDownloading: downloadedAudios.some(
          (audio) => audio._id === _id && audio.isDownloading
        ),
        isDownloaded: downloadedAudios.some(
          (audio) => audio._id === _id && audio.downloaded
        ),
      };
    };

    // Calculate and render audio icons (based on download and playback status)
    const audioIcon = useMemo(() => {
      const { isDownloading, isDownloaded } = getAudioDownloadStatus(
        downloadedAudios,
        _id
      );
      const isCurrentVoice = voiceData?._id === _id;

      // Show upload progress for pending voice messages
      if (
        msgData.status === "pending" &&
        msgData.uploadProgress !== undefined
      ) {
        return (
          <div className="relative flex-center">
            <CircularProgress progress={msgData.uploadProgress} />
            <IoClose data-aos="zoom-in" className="size-6 absolute" />
          </div>
        );
      }

      if (isCurrentVoice) {
        if (isDownloading) {
          return (
            <span className="absolute flex-center">
              <Loading
                classNames={`absolute w-9 ${
                  isFromMe ? "bg-darkBlue" : "bg-white"
                }`}
              />
              <IoClose data-aos="zoom-in" className="size-6" />
            </span>
          );
        }
        if (isDownloaded) {
          return isPlaying ? (
            <FaPause data-aos="zoom-in" className="size-5" />
          ) : (
            <FaPlay data-aos="zoom-in" className="ml-1" />
          );
        }
        return <FaArrowDown data-aos="zoom-in" className="size-5" />;
      }

      return isDownloaded ? (
        <FaPlay data-aos="zoom-in" className="ml-1" />
      ) : (
        <FaArrowDown data-aos="zoom-in" className="size-5" />
      );
    }, [
      downloadedAudios,
      _id,
      voiceData?._id,
      isFromMe,
      isPlaying,
      msgData.status,
      msgData.uploadProgress,
    ]);

    return (
      <div
        className={`flex items-center gap-2 ${
          isFromMe ? "text-white" : "text-gray-700"
        }`}
      >
        <div className="flex flex-col items-center">
          <button
            className={`rounded-full size-10 cursor-pointer relative flex-center overflow-hidden ${
              isFromMe ? "bg-white text-darkBlue" : "bg-darkBlue text-white"
            }`}
            onClick={(e) => {
              e.stopPropagation();
              togglePlayVoice();
            }}
          >
            {audioIcon}
          </button>
          {msgData.status === "pending" &&
            msgData.uploadProgress !== undefined && (
              <span className="text-[10px] mt-0.5 font-medium">
                {msgData.uploadProgress}%
              </span>
            )}
        </div>
        <AudioWaveDisplay _id={_id} voiceDataProp={voiceDataProp} />
      </div>
    );
  }
);
VoiceMessagePlayer.displayName = "VoiceMessagePlayer";
export default VoiceMessagePlayer;
