import {
  RefCallback,
  RefObject,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

type ElementResizeObserverOptions<T> = {
  ref?: T | RefObject<T> | null | undefined;
  contentType?: 'border-box' | 'content-box';
  onResize?: (dimensions: ObservedDimensions) => void;
};

type ObservedDimensions = {
  width: number | undefined;
  height: number | undefined;
};

type ElementResizeObserverResult<T> = {
  assignRef: RefCallback<T>;
  disconnect: ObserverResponse;
} & ObservedDimensions;

type ObserverResponse = (() => void) | null;

export function isRefObject(x: any): x is RefObject<HTMLElement> {
  return x && typeof x === 'object' && 'current' in x;
}

export function useElementResizeObserver<T extends HTMLElement>({
  ref,
  contentType = 'border-box',
  onResize,
}: ElementResizeObserverOptions<T> = {}): ElementResizeObserverResult<T> {
  const [dimensions, setDimensions] = useState<ObservedDimensions>({
    width: undefined,
    height: undefined,
  });

  const prevDimensions = useRef<ObservedDimensions>({
    width: undefined,
    height: undefined,
  });

  const observerInstanceRef = useRef<ResizeObserver | null>(null);

  const callbackElementRef = useRef<T | null>(null);
  const prevTrackedElementRef = useRef<T | null>(null);

  const onResizeRef = useRef<
    ElementResizeObserverOptions<T>['onResize'] | undefined
  >(undefined);
  onResizeRef.current = onResize;

  const disconnectHandlerRef = useRef<(() => void) | null>(null);

  // track mounted state to ensure we don't attempt to set state on an unmounted component
  const hasUnmounted = useRef(false);
  useEffect(() => {
    return () => {
      hasUnmounted.current = true;
    };
  }, []);

  const useResolveElement = (
    observeFn: (element: T) => ObserverResponse,
    forwardedRef?: T | RefObject<T> | null
  ) => {
    let defaultRef: RefObject<T> | null = null;
    const refElement = useRef<T | null>(null);

    const setElementToObserve = useCallback(() => {
      let element: T | null = null;
      if (callbackElementRef.current) {
        element = callbackElementRef.current;
      } else if (forwardedRef instanceof HTMLElement) {
        element = forwardedRef;
      } else if (refElement.current) {
        element = refElement.current;
      }

      // Don't update or recall the register function unless the element has changed.
      if (prevTrackedElementRef.current === element) return;
      prevTrackedElementRef.current = element;

      if (disconnectHandlerRef.current) {
        disconnectHandlerRef.current();
        disconnectHandlerRef.current = null;
      }

      if (element) {
        disconnectHandlerRef.current = observeFn(element);
      }
    }, [forwardedRef, observeFn]);

    const assignCallbackRef = useCallback(
      (element: T) => {
        if (element) {
          callbackElementRef.current = element;
          setElementToObserve();
        }
      },
      [setElementToObserve]
    );

    if (forwardedRef && isRefObject(forwardedRef)) {
      defaultRef = forwardedRef;
    }

    useEffect(() => {
      if (defaultRef) {
        refElement.current = defaultRef.current;
      }
      setElementToObserve();
    }, [defaultRef, defaultRef?.current, setElementToObserve]);

    return assignCallbackRef;
  };

  const observe = useCallback(
    (element) => {
      if (!observerInstanceRef.current) {
        const instance = new ResizeObserver((entries) => {
          const entry = entries[0];

          let width;
          let height;

          if (entry.borderBoxSize && entry.contentBoxSize) {
            width =
              contentType === 'border-box'
                ? Math.round(entry.borderBoxSize.inlineSize)
                : Math.round(entry.contentBoxSize.inlineSize);

            height =
              contentType === 'border-box'
                ? Math.round(entry.borderBoxSize.blockSize)
                : Math.round(entry.contentBoxSize.blockSize);
          } else {
            width = Math.round(entry.contentRect.width);
            height = Math.round(entry.contentRect.height);
          }

          if (
            prevDimensions.current.height !== height ||
            prevDimensions.current.width !== width
          ) {
            const newDimensions: ObservedDimensions = {
              width,
              height,
            };
            if (onResizeRef.current) {
              onResizeRef.current(newDimensions);
            } else {
              prevDimensions.current.height = height;
              prevDimensions.current.width = width;

              if (!hasUnmounted.current) {
                setDimensions(newDimensions);
              }
            }
          }
        });

        observerInstanceRef.current = instance;
      }

      observerInstanceRef.current.observe(element);

      return () => {
        if (observerInstanceRef.current) {
          observerInstanceRef.current.unobserve(element);
        }
      };
    },
    [contentType]
  );

  const callbackRef = useResolveElement(observe, ref);

  return {
    assignRef: callbackRef,
    width: dimensions.width,
    height: dimensions.height,
    disconnect: disconnectHandlerRef.current,
  } as const;
}
