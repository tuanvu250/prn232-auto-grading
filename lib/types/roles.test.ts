import { describe, expect, it } from "vitest";
import { ROLE_INSTRUCTOR, ROLE_TEACHER, getPrimaryRole, normalizeRoles } from "./roles";

describe("normalizeRoles", () => {
  it("maps ROLE_INSTRUCTOR to ROLE_TEACHER", () => {
    expect(normalizeRoles([ROLE_INSTRUCTOR])).toEqual([ROLE_TEACHER]);
  });

  it("getPrimaryRole prefers admin over teacher", () => {
    expect(getPrimaryRole(["ROLE_ADMIN", ROLE_TEACHER])).toBe("ROLE_ADMIN");
  });
});
