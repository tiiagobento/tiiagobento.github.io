import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useNetworkStatus } from "@/lib/offline/network-status";

function setOnline(value: boolean) {
  Object.defineProperty(window.navigator, "onLine", {
    configurable: true,
    value,
  });
}

describe("useNetworkStatus", () => {
  it("updates when browser goes offline and online", () => {
    setOnline(true);
    const { result } = renderHook(() => useNetworkStatus());

    expect(result.current.online).toBe(true);

    act(() => {
      setOnline(false);
      window.dispatchEvent(new Event("offline"));
    });

    expect(result.current.online).toBe(false);

    act(() => {
      setOnline(true);
      window.dispatchEvent(new Event("online"));
    });

    expect(result.current.online).toBe(true);
  });
});
