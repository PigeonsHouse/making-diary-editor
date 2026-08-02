"use client";

import { useEffect, useRef } from "react";

export function useNavigationGuard(enabled: boolean, message: string) {
  const enabledRef = useRef(enabled);
  const messageRef = useRef(message);
  const allowNavigationRef = useRef(false);
  const guardedUrlRef = useRef("");
  const guardedHistoryStateRef = useRef<unknown>(null);

  enabledRef.current = enabled;
  messageRef.current = message;

  useEffect(() => {
    if (!enabled) return;
    guardedUrlRef.current = window.location.href;
    guardedHistoryStateRef.current = window.history.state;
  }, [enabled]);

  useEffect(() => {
    const allowCurrentNavigation = () => {
      allowNavigationRef.current = true;
      window.setTimeout(() => {
        allowNavigationRef.current = false;
      }, 1_000);
    };
    const confirmNavigation = () => {
      if (!enabledRef.current || allowNavigationRef.current) return true;
      if (!window.confirm(messageRef.current)) return false;
      allowCurrentNavigation();
      return true;
    };
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!enabledRef.current || allowNavigationRef.current) return;
      event.preventDefault();
      event.returnValue = "";
    };
    const onDocumentClick = (event: MouseEvent) => {
      if (!enabledRef.current || event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>("a[href]") : null;
      if (!anchor || anchor.download || (anchor.target && anchor.target !== "_self")) return;
      const destination = new URL(anchor.href, window.location.href);
      const current = new URL(window.location.href);
      if (destination.href === current.href) return;
      if (destination.pathname === current.pathname && destination.search === current.search) return;
      if (confirmNavigation()) return;
      event.preventDefault();
      event.stopImmediatePropagation();
    };
    const onPopState = (event: PopStateEvent) => {
      if (!enabledRef.current || allowNavigationRef.current) return;
      if (confirmNavigation()) return;
      event.stopImmediatePropagation();
      window.history.pushState(guardedHistoryStateRef.current, "", guardedUrlRef.current);
    };

    window.addEventListener("beforeunload", onBeforeUnload);
    document.addEventListener("click", onDocumentClick, true);
    window.addEventListener("popstate", onPopState, true);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("click", onDocumentClick, true);
      window.removeEventListener("popstate", onPopState, true);
    };
  }, []);
}
