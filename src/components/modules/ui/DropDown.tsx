import useModalStore from "@/stores/modalStore";
import { CSSProperties, ReactNode, useEffect, useRef } from "react";
export interface DropDownItemProps {
  onClick?: () => void;
  title: string | ReactNode;
  icon: ReactNode;
  itemClassNames?: string;
}

interface DropDownProps {
  dropDownItems: DropDownItemProps[];
  button: ReactNode;
  classNames?: string;
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  style?: CSSProperties;
}

const DropDown = ({
  dropDownItems,
  button,
  classNames,
  isOpen,
  setIsOpen,
  style,
}: DropDownProps) => {
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const buttonRef = useRef<HTMLDivElement | null>(null);
  const modalOpen = useModalStore((state) => state.isOpen);

  useEffect(() => {
    const handleOutside = (event: Event) => {
      if (
        !dropdownRef.current?.contains(event.target as Node) &&
        !buttonRef.current?.contains(event.target as Node) &&
        !modalOpen
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mouseup", handleOutside);
    document.addEventListener("scroll", handleOutside, true);

    return () => {
      document.removeEventListener("mouseup", handleOutside);
      document.removeEventListener("scroll", handleOutside, true);
    };
  }, [modalOpen, setIsOpen]);

  return (
    <div className={`dropdown ${isOpen && "dropdown-open"}`} ref={dropdownRef}>
      <span
        tabIndex={0}
        role="button"
        onFocus={() => setIsOpen(!isOpen)}
        ref={buttonRef}
        id="buttonRef"
      >
        {button}
      </span>
      {isOpen && (
        <ul
          tabIndex={0}
          className={`dropdown-content menu bg-modalBg rounded-box shadow-xs max-h-64 overflow-y-auto scroll-w-none ${classNames}`}
          style={style}
          id="dropDownContent"
        >
          {dropDownItems.map(
            ({ onClick, title, icon, itemClassNames }, index) => (
              <li
                className={`font-vazirLight text-sm cursor-pointer hover:bg-leftBarBg/[10%] flex items-center gap-4 px-2 py-2 ${itemClassNames}`}
                onClick={onClick}
                key={index}
              >
                <span className="mb-1">{icon}</span>
                <span className="grow">{title}</span>
              </li>
            )
          )}
        </ul>
      )}
    </div>
  );
};

export default DropDown;
