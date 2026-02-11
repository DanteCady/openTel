import { describe, it, expect } from "vitest";
import { transitionCallState, canTransition } from "./state-machine.js";

describe("transitionCallState", () => {
  it("CREATED -> RING (RINGING)", () => {
    expect(transitionCallState("CREATED", "RING")).toBe("RINGING");
  });

  it("CREATED -> ANSWER returns null", () => {
    expect(transitionCallState("CREATED", "ANSWER")).toBeNull();
  });

  it("RINGING -> ANSWER (ANSWERED)", () => {
    expect(transitionCallState("RINGING", "ANSWER")).toBe("ANSWERED");
  });

  it("RINGING -> HANGUP (ENDED)", () => {
    expect(transitionCallState("RINGING", "HANGUP")).toBe("ENDED");
  });

  it("ANSWERED -> HANGUP (ENDED)", () => {
    expect(transitionCallState("ANSWERED", "HANGUP")).toBe("ENDED");
  });

  it("ANSWERED -> ANSWER returns null", () => {
    expect(transitionCallState("ANSWERED", "ANSWER")).toBeNull();
  });

  it("ENDED -> any returns null", () => {
    expect(transitionCallState("ENDED", "HANGUP")).toBeNull();
  });
});

describe("canTransition", () => {
  it("returns true for valid transitions", () => {
    expect(canTransition("CREATED", "RING")).toBe(true);
    expect(canTransition("RINGING", "ANSWER")).toBe(true);
  });

  it("returns false for invalid transitions", () => {
    expect(canTransition("CREATED", "ANSWER")).toBe(false);
    expect(canTransition("ENDED", "HANGUP")).toBe(false);
  });
});
