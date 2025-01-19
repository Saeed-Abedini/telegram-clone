import LeftBar from "./LeftBar";
import MiddleBar from "./MiddleBar";
import RightBar from "./RightBar";

const MainPage = () => {
  return (
    <div className="flex items-center bg-leftBarBg size-full ch:size-full transition-all min-h-dvh duration-400 overflow-y-hidden relative overflow-hidden">
      <LeftBar />
      {/* <MiddleBar />
      <RightBar /> */}
    </div>
  );
};

export default MainPage;
