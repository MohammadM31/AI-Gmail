import { useEffect, useRef } from "react";
import { onMailEvent } from "../services/socketService";
import type { MailEvent } from "../services/socketService";

// Subscribe to mail socket events for the lifetime of the component.
// The handler may change every render; the subscription does not.
export function useMailEvents(handler: (event: MailEvent) => void) {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => onMailEvent((event) => handlerRef.current(event)), []);
}
