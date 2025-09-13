import { IoMdArrowRoundBack } from "react-icons/io";
import { BsEmojiSmile } from "react-icons/bs";
import { MdDone } from "react-icons/md";
import { FaArrowRight, FaRegKeyboard } from "react-icons/fa6";
import { ChangeEvent, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Room from "@/models/room";
import useUserStore from "@/stores/userStore";
import useGlobalStore from "@/stores/globalStore";
import useSockets from "@/stores/useSockets";
import User from "@/models/user";
import { randomHexGenerate, toaster, uploadFile } from "@/utils";
import Button from "../modules/ui/Button";
import Loading from "../modules/ui/Loading";
import { TbCameraPlus } from "react-icons/tb";
import ContactCard from "./ContactCard";
import EmojiPicker from "../modules/EmojiPicker";

const CreateRoom = () => {
  const { _id: myID, rooms } = useUserStore((state) => state);
  const userContacts = rooms.filter(
    (room) => room.type === "private" && room.participants.length > 1
  );
  const socket = useSockets((state) => state.rooms);

  const [isRoomInfoPartShown, setIsRoomInfoPartShown] =
    useState<boolean>(false);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [roomImage, setRoomImage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [roomName, setRoomName] = useState("");
  const [search, setSearch] = useState("");
  const [isEmojiOpen, setIsEmojiOpen] = useState(false);
  const { isRoomDetailsShown, onlineUsers, createRoomType, setter } =
    useGlobalStore((state) => state);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const filteredUserCards = useMemo(() => {
    return userContacts?.length
      ? [...userContacts].filter((data) =>
          (data.participants as User[])
            .find((pd) => pd._id !== myID)
            ?.name.toLocaleLowerCase()
            .includes(search.toLocaleLowerCase())
        )
      : [];
  }, [myID, search, userContacts]);

  if (!createRoomType) return;

  const isUserOnline = (id: string) => {
    return onlineUsers.some((data) => {
      if (data.userID === id) return true;
    });
  };

  const updateSelectedUsers = (userID: string) => {
    const currentSelectedUsers = [...selectedUsers];

    if (currentSelectedUsers.includes(userID)) {
      const userTargetIndex = currentSelectedUsers.findIndex(
        (id) => id === userID
      );
      currentSelectedUsers.splice(userTargetIndex, 1); // splice instead of filter have a better performance here
      setSelectedUsers(currentSelectedUsers);
      return;
    }

    setSelectedUsers((prev) => [...prev, userID]);
  };

  const getBackBtn = () => {
    if (isRoomInfoPartShown) {
      setIsRoomInfoPartShown(false);
    } else {
      setter({ createRoomType: null });
    }
  };

  const getImgUrl = (e: ChangeEvent<HTMLInputElement>) => {
    const imgFile = e.target.files![0];

    if (imgFile) {
      const fileReader = new FileReader();
      fileReader.onload = (ev) => setRoomImage(ev.target?.result as string);

      fileReader.readAsDataURL(imgFile);
      setImageFile(imgFile);
    }

    e.target.files = null; // reset the input value to default
  };

  // Add emoji to text
  const handleEmojiClick = (e: { emoji: string }) => {
    setRoomName((prev) => prev + e.emoji);
  };

  const createRoom = async () => {
    const name = roomName.trim();
    if (!name?.length) return toaster("error", "Please enter room name");

    setIsLoading(true);

    let imageUrl;
    let uploadError = false;

    if (roomImage) {
      try {
        const uploadedImageUrl = imageFile && (await uploadFile(imageFile));
        imageUrl = uploadedImageUrl;
      } catch (error) {
        console.log(error);
        toaster("error", "Failed to upload image,try again ");
        setIsLoading(false);
        uploadError = true;
        return;
      }
    }

    if (uploadError) return;

    const roomData: Partial<Room> = {
      name: roomName,
      admins: [myID],
      avatar: imageUrl as string | undefined,
      participants: [...selectedUsers, myID],
      type: createRoomType,
      creator: myID,
      link: "@" + randomHexGenerate(20),
      locations: [],
      medias: [],
      messages: [],
    };

    socket?.emit("createRoom", { newRoomData: roomData });

    socket?.on("createRoom", () => {
      setTimeout(() => {
        setIsLoading(false);
        setSelectedUsers([]);
        setSearch("");
        setRoomName("");
        setIsRoomInfoPartShown(false);
        setRoomImage(null);
        setter({ createRoomType: null });
      }, 300);
    });
  };

  return (
    <div
      data-aos="fade-right"
      className={`fixed inset-y-0  md:block md:w-[40%] lg:w-[35%] ${
        isRoomDetailsShown ? "xl:w-[25%]" : "xl:w-[30%]"
      }  left-0 bg-leftBarBg size-full text-white z-50`}
    >
      <div className="flex gap-4 bg-inherit items-center w-full px-4 py-3">
        <IoMdArrowRoundBack
          onClick={getBackBtn}
          className="size-6 cursor-pointer"
        />

        {isRoomInfoPartShown ? (
          <div className="capitalize text-sm ">New {createRoomType}</div>
        ) : (
          <div className=" flex flex-col justify-center">
            <div className="capitalize text-sm">New {createRoomType}</div>
            <div className="text-xs text-white/60">
              {selectedUsers.length
                ? `${selectedUsers.length} ${
                    createRoomType === "group"
                      ? "of 200000 selected"
                      : "members"
                  }`
                : createRoomType === "group"
                ? "up to 200000 members"
                : "0 members"}
            </div>
          </div>
        )}
      </div>

      {isRoomInfoPartShown ? (
        <div className="flex items-center gap-3 w-full px-4 mt-2">
          {roomImage ? (
            <Image
              src={roomImage}
              onClick={() => setRoomImage(null)}
              className="cursor-pointer z-20 object-cover size-[60px] rounded-full"
              width={60}
              height={60}
              alt="avatar"
            />
          ) : (
            <div>
              <input
                dir="auto"
                type="file"
                className="hidden"
                id="imgUpload"
                onChange={getImgUrl}
              />
              <label htmlFor="imgUpload">
                <TbCameraPlus className="flex-center cursor-pointer bg-darkBlue rounded-full size-14 p-3.5" />
              </label>
            </div>
          )}

          <div className="flex items-center gap-3 border-b-2 border-darkBlue w-full">
            <input
              dir="auto"
              type="text"
              ref={inputRef}
              value={roomName}
              onChange={(e) => setRoomName(e.target.value)}
              className="w-full basis-[90%] p-2 rounded-sm bg-inherit outline-hidden"
              placeholder={`Enter ${createRoomType} name`}
            />
            {isEmojiOpen ? (
              <FaRegKeyboard
                onClick={() => {
                  setIsEmojiOpen(false);
                  inputRef.current?.focus();
                }}
                className="cursor-pointer size-6 mr-0.5"
              />
            ) : (
              <BsEmojiSmile
                onClick={() => setIsEmojiOpen(true)}
                className="cursor-pointer size-6 mr-0.5"
              />
            )}
          </div>
        </div>
      ) : (
        <>
          <input
            dir="auto"
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-inherit p-1 w-full px-4 outline-hidden text-sm mt-1"
            placeholder={
              createRoomType === "group"
                ? "Who would you like to add?"
                : "Add people to your channel"
            }
          />

          <div className="px-1">
            <div className="flex flex-col mt-1 w-full">
              {filteredUserCards?.map((userData) => (
                <ContactCard
                  key={userData._id}
                  isUserOnline={isUserOnline(userData._id)}
                  selectedUsers={selectedUsers}
                  updateSelectedUsers={updateSelectedUsers}
                  userData={userData}
                  myID={myID}
                />
              ))}
            </div>
          </div>
        </>
      )}

      <Button
        disabled={isLoading}
        size="lg"
        className="absolute bottom-2 right-2 size-14 text-white rounded-full bg-darkBlue flex-center"
        onClick={() => {
          if (isRoomInfoPartShown) {
            createRoom();
          } else {
            setIsRoomInfoPartShown(true);
          }
        }}
      >
        {isLoading ? (
          <Loading size="lg" classNames="absolute bg-white" />
        ) : isRoomInfoPartShown ? (
          <MdDone data-aos="zoom-out" className="size-7" />
        ) : (
          <FaArrowRight data-aos="zoom-out" className="size-7" />
        )}
      </Button>
      {isEmojiOpen && (
        <EmojiPicker
          isEmojiOpen={isEmojiOpen}
          handleEmojiClick={handleEmojiClick}
          style={{ position: "absolute", bottom: 0 }}
        />
      )}
    </div>
  );
};

export default CreateRoom;
