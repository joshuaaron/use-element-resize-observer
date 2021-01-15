import { RefCallback, useCallback, useEffect, useRef, useState } from 'react';
import { useIsomorphicLayoutEffect } from './helpers';

/**
 * Utility type defining the width and the height
 */
export type ObservedDimensions = {
    width: number | undefined;
    height: number | undefined;
};

/**
 * Optional hook parameters.
 */
type ElementResizeObserverOptions = {
    /**
     * Callback that will receive the observed elements newly reported width and height
     */
    onResize?: (dimensions: ObservedDimensions) => void;
};

/**
 * Result returned from the hook.
 */
type ElementResizeObserverResult<T> = {
    /**
     * Callback ref created with `useCallback` that receives the DOM node of the element to be observed.
     */
    assignRef: RefCallback<T>;
} & ObservedDimensions;

/**
 * useElementResizeObserver
 *
 * React hook implementation that observes an element and reports on its changes to its width and height.
 *
 * @param {(dimensions: ObservedDimensions) => void} onResize Callback that receives the observed elements newly reported width and height
 * @returns The callbackRef to be assigned to an element, and the observed elements width and height.
 */
export function useElementResizeObserver<T extends HTMLElement>({
    onResize,
}: ElementResizeObserverOptions = {}): ElementResizeObserverResult<T> {
    const [dimensions, setDimensions] = useState<ObservedDimensions>({
        width: undefined,
        height: undefined,
    });

    // Keep track of previous dimensions and only update state or call onResize if the new values differ.
    const prevDimensions = useRef<ObservedDimensions>({
        width: undefined,
        height: undefined,
    });

    // Store the observer instance, and the element forwarded via assignRef.
    const observerInstanceRef = useRef<ResizeObserver | null>(null);
    const callbackRef = useRef<T | null>();

    // Store the onResize callback in a ref to ensure inline functions don't get recreated each time
    const onResizeRef = useRef<ElementResizeObserverOptions['onResize'] | undefined>(undefined);
    onResizeRef.current = onResize;

    // track mounted state to ensure we don't attempt to set state on an unmounted component
    const hasUnmounted = useRef(false);
    useEffect(() => {
        return () => {
            hasUnmounted.current = true;
        };
    }, []);

    useIsomorphicLayoutEffect(() => {
        if (observerInstanceRef.current) {
            return;
        }

        // The function called whenever an observed resize occurs.
        const resizeCallback = ([entry]: readonly ResizeObserverEntry[]) => {
            let width;
            let height;

            if (entry.borderBoxSize) {
                width = Math.round(
                    Array.isArray(entry.borderBoxSize)
                        ? entry.borderBoxSize[0].inlineSize
                        : entry.borderBoxSize.inlineSize
                );

                height = Math.round(
                    Array.isArray(entry.borderBoxSize)
                        ? entry.borderBoxSize[0].blockSize
                        : entry.borderBoxSize.blockSize
                );
            } else {
                width = Math.round(entry.contentRect.width);
                height = Math.round(entry.contentRect.height);
            }

            if (
                prevDimensions.current.height !== height ||
                prevDimensions.current.width !== width
            ) {
                const newDimensions = { width, height };
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
        };

        observerInstanceRef.current = new ResizeObserver(resizeCallback);

        if (callbackRef.current) {
            observerInstanceRef.current.observe(callbackRef.current, {
                box: 'border-box',
            });
        }

        return () => {
            observerInstanceRef.current?.disconnect();
            observerInstanceRef.current = null;
        };
    }, []);

    const assignRef = useCallback((node: T | null) => {
        if (callbackRef.current) {
            observerInstanceRef.current?.unobserve(callbackRef.current);
        }

        callbackRef.current = node;
        if (node) {
            observerInstanceRef.current?.observe(node);
        }
    }, []);

    return {
        assignRef,
        width: dimensions.width,
        height: dimensions.height,
    } as const;
}
