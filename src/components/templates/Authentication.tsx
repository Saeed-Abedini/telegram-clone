"use client";
import Loading from "@/components/modules/Loading";
import useUserStore from "@/store/userStore";
import axios from "axios";
import { ReactNode, lazy, useEffect, useState } from "react";
const AuthenticationForm = lazy(
  () => import("@/components/templates/AuthenticationForm")
);
const Authentication = ({ children }: { children: ReactNode }) => {
  const [isLoading, setIsLoading] = useState(true);
  const { setter, isLogin } = useUserStore((state) => state);

  useEffect(() => {
    (async () => {
      try {
        const response = await axios.post("/api/auth/currentuser");

        if (response.status == 200) {
          setter({
            ...response.data,
            isLogin: true,
          });
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } catch (error: any) {
        console.log(error.message);
      } finally {
        setIsLoading(false);
      }
    })();
  }, [setter]);

  if (isLoading) return <Loading />;

  return <>{isLogin ? <>{children}</> : <AuthenticationForm />}</>;
};

export default Authentication;
