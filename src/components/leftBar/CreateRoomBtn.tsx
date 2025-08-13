import { useState } from "react";
import { MdModeEditOutline } from "react-icons/md";
import { IoClose } from "react-icons/io5";
import useGlobalStore from "@/stores/globalStore";
import DropDown from "../modules/ui/DropDown";
import { HiOutlineSpeakerphone } from "react-icons/hi";
import { HiMiniUserGroup } from "react-icons/hi2";

const CreateRoomBtn = () => {
  const [isDropDownOpen, setIsDropDownOpen] = useState(false);
  const { setter } = useGlobalStore((state) => state);

  const dropDownItems = [
    {
      title: "New Channel",
      onClick: () => {
        setter({ createRoomType: "channel" });
        setIsDropDownOpen(false);
      },
      icon: <HiOutlineSpeakerphone className="size-5 mr-3 text-gray-400" />,
    },
    {
      title: "New Group",
      onClick: () => {
        setter({ createRoomType: "group" });
        setIsDropDownOpen(false);
      },
      icon: <HiMiniUserGroup className="size-5 mr-3 text-gray-400" />,
    },
  ];

  return (
    <div
      className={`absolute right-3 bottom-3 z-10 text-white cursor-pointer`}
      onClick={() => setIsDropDownOpen(!isDropDownOpen)}
    >
      <DropDown
        dropDownItems={dropDownItems}
        classNames="bottom-16 right-0 w-40"
        isOpen={isDropDownOpen}
        setIsOpen={setIsDropDownOpen}
        button={
          <div className="bg-darkBlue size-14 rounded-full flex-center">
            {isDropDownOpen ? (
              <IoClose data-aos="zoom-in" className="size-7" />
            ) : (
              <MdModeEditOutline data-aos="zoom-in" className="size-7" />
            )}
          </div>
        }
      />
    </div>
  );
};

export default CreateRoomBtn;
