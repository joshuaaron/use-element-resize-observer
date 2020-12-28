import { RefCallback, RefObject } from 'react';

type ElementResizeObserverOptions<T> = {
    ref?: T | RefObject<T> | null | undefined;
    onResize?: (dimensions: ObservedDimensions) => void;
}

type ObservedDimensions = {
    width: number | undefined;
    height: number | undefined;
}

type ElementResizeObserverResult<T> = {
    assignRef: RefCallback<T>
} & ObservedDimensions;

export function useElementResizeObserver<T extends HTMLElement>() {}
