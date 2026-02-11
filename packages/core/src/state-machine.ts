import type { CallState } from "@opentel/schemas";

type TransitionEvent = "RING" | "ANSWER" | "HANGUP";

const TRANSITIONS: Record<CallState, Partial<Record<TransitionEvent, CallState>>> = {
  CREATED: { RING: "RINGING" },
  RINGING: { ANSWER: "ANSWERED", HANGUP: "ENDED" },
  ANSWERED: { HANGUP: "ENDED" },
  ENDED: {},
};

export function transitionCallState(
  currentState: CallState,
  event: TransitionEvent
): CallState | null {
  const next = TRANSITIONS[currentState]?.[event];
  return next ?? null;
}

export function canTransition(currentState: CallState, event: TransitionEvent): boolean {
  return transitionCallState(currentState, event) !== null;
}
