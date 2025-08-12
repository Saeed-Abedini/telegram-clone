import { ReactNode, useEffect, useState } from "react";
import Main from "./Main";
import Settings from "./Settings";
import EditInfo from "./EditInfo";
import EditUsername from "./EditUsername";

interface Props {
  isOpen: boolean;
  closeMenu: () => void;
  onRouteChanged: (route: string) => void;
}

const LeftBarMenu = ({ closeMenu, isOpen, onRouteChanged }: Props) => {
  const [route, setRoute] = useState("/");
  const [activeRoute, setActiveRoute] = useState<ReactNode>(<div></div>);

  const getBack = () => {
    if (route.length === 1) return;

    const lastIndex = route.lastIndexOf("/");
    const updatedRoute = route.slice(0, lastIndex) || "/";

    setRoute(updatedRoute);
  };

  const updateRoute = (path: string) => {
    setRoute((prev) => {
      return prev.includes(path)
        ? prev
        : prev
            .concat(`${prev.length !== 1 ? "/" : ""} ${path}`)
            .replaceAll(" ", "");
    });
  };

  useEffect(() => {
    onRouteChanged(route);
    switch (route) {
      case "/": {
        setActiveRoute(
          <Main
            isOpen={isOpen}
            closeMenu={closeMenu}
            updateRoute={updateRoute}
          />
        );
        break;
      }
      case "/settings": {
        setActiveRoute(
          <Settings updateRoute={updateRoute} getBack={getBack} />
        );
        break;
      }
      case "/settings/edit-info": {
        setActiveRoute(<EditInfo getBack={getBack} />);
        break;
      }
      case "/settings/edit-username": {
        setActiveRoute(<EditUsername getBack={getBack} />);
        break;
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route, isOpen]);

  return (
    <>
      <span
        onClick={closeMenu}
        className={`fixed ${
          isOpen ? "w-full" : "w-0 hidden"
        } h-[100vh] left-0 inset-y-0 z-9999 backdrop-filter bg-black/30`}
      />

      {activeRoute}
    </>
  );
};

export default LeftBarMenu;
