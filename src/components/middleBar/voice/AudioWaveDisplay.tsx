import { memo, useCallback, useEffect, useMemo, useRef } from "react";
import useAudio from "@/stores/audioStore";
import { secondsToTimeString } from "@/utils";
import Voice from "@/models/voice";

interface AudioWaveDisplayProps {
  _id: string;
  voiceDataProp: Voice | null | undefined;
}

const AudioWaveDisplay = memo(
  ({ _id, voiceDataProp }: AudioWaveDisplayProps) => {
    const voiceCurrentTimeRef = useRef<HTMLDivElement | null>(null);
    const animationRef = useRef<number | null>(null);

    const voiceData = useAudio((state) => state.voiceData);
    const audioElem = useAudio((state) => state.audioElem);

    // The structure of sound waves
    const { songWaves, waveUpdater, resetWaves } = useMemo(() => {
      const waveUpdater = (progress: number) => {
        const activeWaveIndex = Math.floor(progress * 25);
        const partialFill = (progress * 25 - activeWaveIndex) * 100;
        for (let i = 0; i < 25; i++) {
          const elem = document.getElementById(`${_id}${i}`);
          if (elem) {
            if (i < activeWaveIndex) {
              elem.style.background = "white";
            } else if (i === activeWaveIndex) {
              elem.style.background = `linear-gradient(to right, white ${partialFill}%, #4bbfff ${partialFill}%)`;
            } else {
              elem.style.background = "#4bbfff";
            }
          }
        }
      };

      const resetWaves = () => {
        for (let i = 0; i < 25; i++) {
          const elem = document.getElementById(`${_id}${i}`);
          if (elem) {
            elem.style.background = "#4bbfff";
          }
        }
      };

      const waves = Array.from({ length: 25 }, (_, index) => {
        const randomHeight = Math.random() * 10 + 6;
        return (
          <div
            id={`${_id}${index}`}
            key={index}
            className="w-[0.17rem] rounded-4xl"
            style={{ height: `${randomHeight}px` }}
          />
        );
      });

      return { songWaves: waves, waveUpdater, resetWaves };
    }, [_id]);

    const updateWave = useCallback(() => {
      if (!audioElem || voiceData?._id !== _id) {
        resetWaves();
        return;
      }
      const totalTime = voiceData.duration || audioElem.duration;
      const currentTime = audioElem.currentTime || 0;
      const progress = totalTime ? currentTime / totalTime : 0;
      waveUpdater(progress);
      if (voiceCurrentTimeRef.current) {
        voiceCurrentTimeRef.current.innerText =
          secondsToTimeString(currentTime);
      }
      animationRef.current = requestAnimationFrame(updateWave);
    }, [
      _id,
      audioElem,
      voiceData?.duration,
      voiceData?._id,
      resetWaves,
      waveUpdater,
    ]);

    // Update audio waves (animation)
    useEffect(() => {
      animationRef.current = requestAnimationFrame(updateWave);

      return () => {
        if (animationRef.current) {
          cancelAnimationFrame(animationRef.current);
          resetWaves();
        }
      };
    }, [updateWave, resetWaves, voiceData?._id]);

    return (
      <div className="flex flex-col gap-2">
        <div className="overflow-hidden text-nowrap flex items-center gap-[1.5px] relative z-0">
          {songWaves}
        </div>
        <div className="flex items-center gap-1">
          <div ref={voiceCurrentTimeRef} className="text-[12px] text-white/60">
            {secondsToTimeString(voiceDataProp?.duration || 0)}
          </div>
          <span
            className={`size-1.5 ml-1 mb-0.5 rounded-full ${
              voiceDataProp?.playedBy && voiceDataProp?.playedBy?.length === 0
                ? "bg-white"
                : ""
            }`}
          />
        </div>
      </div>
    );
  }
);

AudioWaveDisplay.displayName = "AudioWaveDisplay";

export default AudioWaveDisplay;
