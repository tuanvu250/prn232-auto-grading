import { describe, expect, it, vi } from "vitest";

import {
  compareNaturalText,
  normalizeOptionalUrl,
  normalizeSessionDeadline,
  uniqueIds,
} from "./grading-session";

describe("grading session validation", () => {
  it("sorts lab codes by their numeric order", () => {
    expect(["LAB10", "Lab3", "LAB1", "LAB2"].sort(compareNaturalText)).toEqual([
      "LAB1",
      "LAB2",
      "Lab3",
      "LAB10",
    ]);
  });

  it("normalizes optional URLs and rejects malformed values", () => {
    expect(normalizeOptionalUrl("  ")).toBeNull();
    expect(normalizeOptionalUrl("https://drive.google.com/folder/1")).toBe(
      "https://drive.google.com/folder/1"
    );
    expect(() => normalizeOptionalUrl("not a url")).toThrow("valid URL");
  });

  it("requires future deadlines for newly opened sessions", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-16T00:00:00.000Z"));
    expect(normalizeSessionDeadline("2026-07-17T00:00:00.000Z")).toBe("2026-07-17T00:00:00.000Z");
    expect(() => normalizeSessionDeadline("2026-07-15T00:00:00.000Z")).toThrow("future");
    vi.useRealTimers();
  });

  it("allows historical deadlines when maintaining a closed legacy session", () => {
    expect(normalizeSessionDeadline("2020-01-01T00:00:00.000Z", true)).toBe(
      "2020-01-01T00:00:00.000Z"
    );
  });

  it("deduplicates and removes empty class IDs", () => {
    expect(uniqueIds(["class-a", "", " class-a ", "class-b"])).toEqual(["class-a", "class-b"]);
  });
});
