import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// --- Hoisted mocks -----------------------------------------------------------------
const { fromMock, rpcMock, getServerUserMock, notifyDiscordResubmissionMock, fromQueue } =
  vi.hoisted(() => {
    const fromQueue: any[] = [];
    return {
      fromQueue,
      fromMock: vi.fn(() => {
        const next = fromQueue.shift();
        if (!next) {
          throw new Error("Unexpected extra call to supabaseServer.from() — queue exhausted");
        }
        return next;
      }),
      rpcMock: vi.fn(),
      getServerUserMock: vi.fn(),
      notifyDiscordResubmissionMock: vi.fn(async () => {}),
    };
  });

vi.mock("@/lib/server/supabase", () => ({
  supabaseServer: {
    from: fromMock,
    rpc: rpcMock,
  },
}));

vi.mock("@/lib/server/auth", () => ({
  getServerUser: getServerUserMock,
  userIsAdmin: vi.fn(),
}));

vi.mock("@/lib/server/discord", () => ({
  notifyDiscordResubmission: notifyDiscordResubmissionMock,
}));

import {
  createResubmissionRequestAction,
  getCurrentClassStudentIdAction,
  getStudentLabOverviewAction,
} from "./erd-student";

// --- Query builder helper ------------------------------------------------------------
// Mimics the subset of the supabase-js fluent query builder used by erd-student.ts.
// Every chain method returns `this`; the object is also "thenable" so `await builder`
// works for call-sites that never terminate the chain with .single()/.maybeSingle()
// (e.g. the head-count query in checkResubmissionRateLimit).
function makeBuilder(result: { data?: unknown; error?: unknown; count?: number | null }) {
  const builder: any = {};
  const chainMethods = ["select", "eq", "order", "limit", "gte", "insert", "update"];
  for (const method of chainMethods) {
    builder[method] = vi.fn(() => builder);
  }
  builder.maybeSingle = vi.fn(() => Promise.resolve(result));
  builder.single = vi.fn(() => Promise.resolve(result));
  builder.then = (onFulfilled: any, onRejected: any) =>
    Promise.resolve(result).then(onFulfilled, onRejected);
  return builder;
}

const STUDENT_USER = {
  email: "student@example.com",
  name: "Student One",
  role: "ROLE_STUDENT",
  className: "SE1234",
  studentId: "SE123456",
};

function queueHappyEnrollmentLookup(classStudentId = "cs-1") {
  // 1) students lookup
  fromQueue.push(makeBuilder({ data: { id: "student-1" }, error: null }));
  // 2) class_students lookup
  fromQueue.push(makeBuilder({ data: [{ id: classStudentId }], error: null }));
}

beforeEach(() => {
  fromQueue.length = 0;
  fromMock.mockClear();
  rpcMock.mockReset();
  getServerUserMock.mockReset();
  notifyDiscordResubmissionMock.mockClear();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("getCurrentClassStudentIdAction", () => {
  it("throws Unauthorized when there is no server user", async () => {
    getServerUserMock.mockResolvedValue(null);
    await expect(getCurrentClassStudentIdAction()).rejects.toThrow("Unauthorized");
  });

  it("returns null when the user has no email/className on the JWT", async () => {
    getServerUserMock.mockResolvedValue({ ...STUDENT_USER, email: "", className: "" });
    await expect(getCurrentClassStudentIdAction()).resolves.toBeNull();
  });

  it("returns null when no matching student row exists", async () => {
    getServerUserMock.mockResolvedValue(STUDENT_USER);
    fromQueue.push(makeBuilder({ data: null, error: null }));
    await expect(getCurrentClassStudentIdAction()).resolves.toBeNull();
  });

  it("resolves the class_student id when enrollment is found", async () => {
    getServerUserMock.mockResolvedValue(STUDENT_USER);
    queueHappyEnrollmentLookup("cs-42");
    await expect(getCurrentClassStudentIdAction()).resolves.toBe("cs-42");
  });
});

describe("getStudentLabOverviewAction", () => {
  it("returns an empty array when the student has no enrollment", async () => {
    getServerUserMock.mockResolvedValue(STUDENT_USER);
    fromQueue.push(makeBuilder({ data: null, error: null })); // students -> not found
    await expect(getStudentLabOverviewAction()).resolves.toEqual([]);
  });

  it("throws when the RPC errors", async () => {
    getServerUserMock.mockResolvedValue(STUDENT_USER);
    queueHappyEnrollmentLookup();
    rpcMock.mockResolvedValue({ data: null, error: { message: "boom" } });
    await expect(getStudentLabOverviewAction()).rejects.toThrow("boom");
  });
});

describe("createResubmissionRequestAction", () => {
  it("rejects a non-Google-Drive link without touching the rate limit / submission lookups", async () => {
    getServerUserMock.mockResolvedValue(STUDENT_USER);
    queueHappyEnrollmentLookup();

    const result = await createResubmissionRequestAction(
      "class-lab-1",
      "https://evil.example.com/not-drive",
      null
    );

    expect(result).toEqual({
      success: false,
      error: "Link must be a Google Drive/Docs link",
    });
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("accepts a subdomain of drive.google.com as a valid link (via observable behavior)", async () => {
    getServerUserMock.mockResolvedValue(STUDENT_USER);
    queueHappyEnrollmentLookup();
    // rate limit checks: no last request, count 0
    fromQueue.push(makeBuilder({ data: null, error: null }));
    fromQueue.push(makeBuilder({ data: null, error: null, count: 0 }));
    // no prior submission -> should fail on "haven't submitted" rather than "invalid link"
    fromQueue.push(makeBuilder({ data: null, error: null }));

    const result = await createResubmissionRequestAction(
      "class-lab-1",
      "https://docs.drive.google.com/file/d/abc",
      null
    );

    expect(result.error).not.toBe("Link must be a Google Drive/Docs link");
    expect(result).toEqual({
      success: false,
      error: "You haven't submitted this lab yet",
    });
  });

  it("returns a friendly error (does not throw) when there is no prior submission for the lab", async () => {
    getServerUserMock.mockResolvedValue(STUDENT_USER);
    queueHappyEnrollmentLookup();
    fromQueue.push(makeBuilder({ data: null, error: null })); // rate limit: last request
    fromQueue.push(makeBuilder({ data: null, error: null, count: 0 })); // rate limit: count
    fromQueue.push(makeBuilder({ data: null, error: null })); // submission lookup -> none

    const result = await createResubmissionRequestAction(
      "class-lab-1",
      "https://drive.google.com/file/d/xyz",
      null
    );

    expect(result).toEqual({
      success: false,
      error: "You haven't submitted this lab yet",
    });
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("returns a friendly error when the RPC signals resubmission_limit_reached", async () => {
    getServerUserMock.mockResolvedValue(STUDENT_USER);
    queueHappyEnrollmentLookup();
    fromQueue.push(makeBuilder({ data: null, error: null })); // rate limit: last request
    fromQueue.push(makeBuilder({ data: null, error: null, count: 0 })); // rate limit: count
    fromQueue.push(
      makeBuilder({ data: { id: "sub-1", class_lab_id: "class-lab-1" }, error: null })
    ); // submission lookup -> found

    rpcMock.mockResolvedValue({
      data: null,
      error: { message: "resubmission_limit_reached: max 3 attempts" },
    });

    const result = await createResubmissionRequestAction(
      "class-lab-1",
      "https://drive.google.com/file/d/xyz",
      "please regrade"
    );

    expect(result).toEqual({
      success: false,
      error: "Resubmission limit reached (max 3 per lab)",
    });
    expect(notifyDiscordResubmissionMock).not.toHaveBeenCalled();
  });

  it("rethrows unexpected RPC errors instead of swallowing them", async () => {
    getServerUserMock.mockResolvedValue(STUDENT_USER);
    queueHappyEnrollmentLookup();
    fromQueue.push(makeBuilder({ data: null, error: null }));
    fromQueue.push(makeBuilder({ data: null, error: null, count: 0 }));
    fromQueue.push(
      makeBuilder({ data: { id: "sub-1", class_lab_id: "class-lab-1" }, error: null })
    );

    rpcMock.mockResolvedValue({ data: null, error: { message: "some other db error" } });

    await expect(
      createResubmissionRequestAction("class-lab-1", "https://drive.google.com/file/d/xyz", null)
    ).rejects.toThrow("some other db error");
  });

  it("succeeds, notifies Discord, and returns success on the happy path", async () => {
    getServerUserMock.mockResolvedValue(STUDENT_USER);
    queueHappyEnrollmentLookup();
    fromQueue.push(makeBuilder({ data: null, error: null }));
    fromQueue.push(makeBuilder({ data: null, error: null, count: 0 }));
    fromQueue.push(
      makeBuilder({ data: { id: "sub-1", class_lab_id: "class-lab-1" }, error: null })
    );
    fromQueue.push(
      makeBuilder({
        data: { labs: { code: "LAB2", title: "Advanced REST API & Security" } },
        error: null,
      })
    );

    rpcMock.mockResolvedValue({ data: null, error: null });

    const result = await createResubmissionRequestAction(
      "class-lab-1",
      "https://drive.google.com/file/d/xyz",
      "  note  "
    );

    expect(result).toEqual({ success: true });
    expect(notifyDiscordResubmissionMock).toHaveBeenCalledTimes(1);
    expect(notifyDiscordResubmissionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "new",
        labId: "LAB2 - Advanced REST API & Security",
        note: "note",
      })
    );
  });

  it("blocks with a cooldown message when the last request was very recent", async () => {
    getServerUserMock.mockResolvedValue(STUDENT_USER);
    queueHappyEnrollmentLookup();
    fromQueue.push(
      makeBuilder({ data: { updated_at: new Date().toISOString() }, error: null })
    );

    const result = await createResubmissionRequestAction(
      "class-lab-1",
      "https://drive.google.com/file/d/xyz",
      null
    );

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/wait \d+s before trying again/);
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("blocks with a per-hour limit message when the pending count is at the cap", async () => {
    getServerUserMock.mockResolvedValue(STUDENT_USER);
    queueHappyEnrollmentLookup();
    fromQueue.push(makeBuilder({ data: null, error: null })); // no recent request
    fromQueue.push(makeBuilder({ data: null, error: null, count: 5 })); // at the cap

    const result = await createResubmissionRequestAction(
      "class-lab-1",
      "https://drive.google.com/file/d/xyz",
      null
    );

    expect(result).toEqual({
      success: false,
      error: "You can only submit 5 pending requests per hour.",
    });
  });

  it("returns an error (does not throw) when there is no class_student enrollment", async () => {
    getServerUserMock.mockResolvedValue(STUDENT_USER);
    fromQueue.push(makeBuilder({ data: null, error: null })); // students -> not found

    const result = await createResubmissionRequestAction(
      "class-lab-1",
      "https://drive.google.com/file/d/xyz",
      null
    );

    expect(result).toEqual({ success: false, error: "Student enrollment not found" });
  });
});
