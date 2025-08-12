import { RefObject, useEffect, useMemo } from "react";

export const useOnScreen = (
  ref: RefObject<HTMLDivElement | null>,
  onIntersect: (isIntersecting: boolean) => void
) => {
  const observer = useMemo(() => {
    return new IntersectionObserver(
      ([entry]) => {
        onIntersect(entry.isIntersecting);
      },
      {
        threshold: 1.0,
      }
    );

  }, [onIntersect]);

  useEffect(() => {
    const currentElement = ref.current;

    if (currentElement) {
      observer.observe(currentElement);
    }

    return () => {
      if (currentElement) {
        observer.unobserve(currentElement);
      }
    };
  }, [ref, observer]);

  useEffect(() => {
    return () => {
      observer.disconnect();
    };
  }, [observer]);
};
