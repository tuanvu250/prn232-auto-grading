import { describe, expect, it, vi } from "vitest";

import {
  compareNaturalText,
  normalizeOptionalUrl,
  normalizeSessionDeadline,
  selectLatestMatrixLabSessions,
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

  it("selects only the newest LAB1, LAB2 and LAB3 sessions for the grade matrix", () => {
    const sessions = [
      { id: "lab1-old", lab_code: "LAB1", created_at: "2026-07-01T00:00:00.000Z" },
      { id: "lab4", lab_code: "LAB4", created_at: "2026-07-04T00:00:00.000Z" },
      { id: "lab2", lab_code: "LAB2", created_at: "2026-07-02T00:00:00.000Z" },
      { id: "lab1-new", lab_code: "lab 1", created_at: "2026-07-05T00:00:00.000Z" },
      { id: "lab3", lab_code: "Lab3", created_at: "2026-07-03T00:00:00.000Z" },
    ];

    expect(selectLatestMatrixLabSessions(sessions).map((session) => session.id)).toEqual([
      "lab1-new",
      "lab2",
      "lab3",
    ]);
  });
});
