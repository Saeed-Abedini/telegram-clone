import { ReactNode } from "react";
import { IoArrowBackOutline } from "react-icons/io5";

interface Props {
  children: ReactNode;
  title?: string;
  leftHeaderChild?: ReactNode;
  getBack: () => void;
}

const LeftBarContainer = ({
  children,
  leftHeaderChild,
  title,
  getBack,
}: Props) => {
  return (
    <div
      data-aos="fade-right"
      className="size-full h-dvh bg-leftBarBg  overflow-x-hidden scroll-w-none z-50"
      style={{ zIndex: 99999999 }}
    >
      <div className="flex items-center p-4 sticky top-0  z-50 justify-between w-full text-white bg-leftBarBg ">
        <div className="flex items-center gap-4">
          <IoArrowBackOutline
            onClick={getBack}
            className="size-6 cursor-pointer"
          />
          {title ? (
            <p className="font-bold font-vazirBold text-base">{title}</p>
          ) : null}
        </div>

        {leftHeaderChild}
      </div>

      <div className="z-30 ">{children}</div>
    </div>
  );
};

export default LeftBarContainer;
