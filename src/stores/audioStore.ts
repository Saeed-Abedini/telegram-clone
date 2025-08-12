import Message from "@/models/message";
import User from "@/models/user";
import Voice from "@/models/voice";
import { create } from "zustand";

interface DownloadedAudio {
  _id: string;
  src?: string;
  downloaded: boolean;
  isDownloading: boolean;
}
interface Updater {
  updater: (key: keyof User, value: User[keyof User]) => void;
  isPlaying: boolean;
  audioElem: HTMLAudioElement | null;
  currentTime: number;
  voiceData: (Voice & Message) | null;
  downloadedAudios: DownloadedAudio[];
  setter: (
    partialState: Partial<Updater> | ((state: Updater) => Partial<Updater>)
  ) => void;
  setVoiceDataAndPlay: (voice: Voice & Message) => void;
  toggleAudioPlayback: () => void;
  setAudioElement: (audio: HTMLAudioElement) => void;
}

const useAudio = create<Updater>((set) => ({
  isPlaying: false,
  audioElem: null,
  currentTime: 0,
  voiceData: null,
  downloadedAudios: [],

  updater: (key, value) =>
    set((state) => ({
      ...state,
      [key]: value,
    })),

  setter: (partialState) => set(partialState),

  setAudioElement: (audio) => {
    set({ audioElem: audio });
    audio.onended = () => {
      set({
        isPlaying: false,
        currentTime: 0,
        voiceData: null,
      });
    };
    audio.ontimeupdate = () => {
      set({ currentTime: audio.currentTime });
    };
  },

  setVoiceDataAndPlay: (voice) =>
    set((state) => {
      const audioElem = state.audioElem;
      if (!audioElem) return {};

      if (audioElem.src !== voice.src) {
        audioElem.pause();
        audioElem.currentTime = 0;
        audioElem.src = voice.src;
        audioElem.load();
      } else if (!state.isPlaying) {
        audioElem.currentTime = 0;
      }

      return {
        isPlaying: true,
        voiceData: voice,
        currentTime: 0,
      };
    }),

  toggleAudioPlayback: () =>
    set((state): Partial<Updater> => {
      if (state.audioElem) {
        if (state.isPlaying) {
          state.audioElem.pause();
        } else {
          state.audioElem.play();
        }
        return { isPlaying: !state.isPlaying };
      } else {
        return {};
      }
    }),
}));

export default useAudio;
