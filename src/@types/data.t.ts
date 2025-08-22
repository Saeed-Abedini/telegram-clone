interface UserModel {
  _id: string;
  name: string;
  lastName: string;
  username: string;
  password: string;
  phone: string;
  rooms: RoomModel[];
  avatar: string;
  biography: string;
  status: "online" | "offline";
  isLogin: boolean;
  roomMessageTrack: { roomId: string; scrollPos: number }[];
  createdAt: string;
  updatedAt: string;
}

interface MessageModel {
  _id: string;
  message: string;
  sender: UserModel;
  isEdited: boolean;
  seen: string[];
  replays: string[];
  pinnedAt: string | null;
  voiceData: { src: string; duration: number; playedBy: string[] } | null;
  replayedTo: { message: string; msgID: string; username: string } | null;
  roomID: string;
  hideFor: string[];
  createdAt: string;
  updatedAt: string;
  status?: "pending" | "sent" | "failed";
  uploadProgress?: number;
}

interface LocationModel {
  _id: string;
  x: number;
  y: number;
  sender: UserModel;
  roomID: string;
  createdAt: string;
  updatedAt: string;
}

interface MediaModel {
  _id: string;
  file: File;
  sender: UserModel;
  roomID: string;
  createdAt: string;
  updatedAt: string;
}

interface RoomModel {
  _id: string;
  name: string;
  avatar: string;
  participants: UserModel[];
  admins: string[];
  type: "group" | "private" | "chanel";
  creator: string;
  messages: MessageModel[];
  locations: LocationModel[];
  medias: MediaModel[];
  notSeenCount?: number;
  link: string;
  createdAt: string;
  updatedAt: string;
}

interface NameSpaceModel {
  _id: string;
  title: string;
  rooms: RoomModel[];
  createdAt: string;
  updatedAt: string;
}

interface VoiceModel {
  duration: number;
  playedBy: string[];
  src: string;
}

export type {
  UserModel,
  MessageModel,
  LocationModel,
  MediaModel,
  RoomModel,
  NameSpaceModel,
  VoiceModel,
};
