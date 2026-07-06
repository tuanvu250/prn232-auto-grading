import { beforeEach, describe, expect, it, vi } from "vitest";

const { fromMock, rpcMock, getServerUserMock, userIsAdminMock, fromQueue } = vi.hoisted(() => {
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
    userIsAdminMock: vi.fn(),
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
  userIsAdmin: userIsAdminMock,
}));

import {
  createLabAction,
  getClassLabStudentResultsAction,
  getClassLabsForClassAction,
  getTermsAction,
} from "./erd-admin";

function makeBuilder(result: { data?: unknown; error?: unknown }) {
  const builder: any = {};
  for (const method of ["select", "eq", "order", "insert", "update"]) {
    builder[method] = vi.fn(() => builder);
  }
  builder.single = vi.fn(() => Promise.resolve(result));
  builder.maybeSingle = vi.fn(() => Promise.resolve(result));
  builder.then = (onFulfilled: any, onRejected: any) =>
    Promise.resolve(result).then(onFulfilled, onRejected);
  return builder;
}

const ADMIN_USER = { email: "admin@example.com", role: "ROLE_ADMIN" };
const NON_ADMIN_USER = { email: "nobody@example.com", role: "ROLE_STUDENT" };

beforeEach(() => {
  fromQueue.length = 0;
  fromMock.mockClear();
  rpcMock.mockReset();
  getServerUserMock.mockReset();
  userIsAdminMock.mockReset();
});

describe("requireAdmin guard (exercised through exported actions)", () => {
  it("throws Forbidden when there is no logged-in user", async () => {
    getServerUserMock.mockResolvedValue(null);
    await expect(getTermsAction()).rejects.toThrow("Forbidden: admin access required");
    expect(fromMock).not.toHaveBeenCalled();
  });

  it("throws Forbidden when the user is logged in but not an admin", async () => {
    getServerUserMock.mockResolvedValue(NON_ADMIN_USER);
    userIsAdminMock.mockReturnValue(false);
    await expect(getTermsAction()).rejects.toThrow("Forbidden: admin access required");
    expect(fromMock).not.toHaveBeenCalled();
  });

  it("allows the call through for an admin user", async () => {
    getServerUserMock.mockResolvedValue(ADMIN_USER);
    userIsAdminMock.mockReturnValue(true);
    fromQueue.push(makeBuilder({ data: [{ id: "t1", name: "Fall 2026" }], error: null }));

    await expect(getTermsAction()).resolves.toEqual([{ id: "t1", name: "Fall 2026" }]);
  });
});

describe("getClassLabsForClassAction", () => {
  it("maps the joined labs row into lab_code / lab_title", async () => {
    getServerUserMock.mockResolvedValue(ADMIN_USER);
    userIsAdminMock.mockReturnValue(true);
    fromQueue.push(
      makeBuilder({
        data: [
          {
            id: "cl-1",
            class_id: "c-1",
            lab_id: "l-1",
            deadline: null,
            drive_root_url: "https://drive.google.com/drive/folders/root",
            labs: { code: "LAB01", title: "Intro" },
          },
        ],
        error: null,
      })
    );

    const result = await getClassLabsForClassAction("c-1");
    expect(result).toEqual([
      {
        id: "cl-1",
        class_id: "c-1",
        lab_id: "l-1",
        deadline: null,
        drive_root_url: "https://drive.google.com/drive/folders/root",
        lab_code: "LAB01",
        lab_title: "Intro",
      },
    ]);
  });

  it("defaults lab_code to an empty string when the join is null", async () => {
    getServerUserMock.mockResolvedValue(ADMIN_USER);
    userIsAdminMock.mockReturnValue(true);
    fromQueue.push(
      makeBuilder({
        data: [{ id: "cl-1", class_id: "c-1", lab_id: "l-1", deadline: null, drive_root_url: null, labs: null }],
        error: null,
      })
    );

    const result = await getClassLabsForClassAction("c-1");
    expect(result[0].lab_code).toBe("");
    expect(result[0].lab_title).toBeNull();
  });
});

describe("getClassLabStudentResultsAction", () => {
  it("throws when the aggregate RPC errors", async () => {
    getServerUserMock.mockResolvedValue(ADMIN_USER);
    userIsAdminMock.mockReturnValue(true);
    rpcMock.mockResolvedValue({ data: null, error: { message: "rpc failed" } });

    await expect(getClassLabStudentResultsAction("cl-1")).rejects.toThrow("rpc failed");
  });

  it("returns an empty array when data is null", async () => {
    getServerUserMock.mockResolvedValue(ADMIN_USER);
    userIsAdminMock.mockReturnValue(true);
    rpcMock.mockResolvedValue({ data: null, error: null });

    await expect(getClassLabStudentResultsAction("cl-1")).resolves.toEqual([]);
  });
});

describe("createLabAction", () => {
  it("throws when the normalized code is empty", async () => {
    getServerUserMock.mockResolvedValue(ADMIN_USER);
    userIsAdminMock.mockReturnValue(true);

    await expect(createLabAction("   ", null)).rejects.toThrow("Lab code is required");
    expect(fromMock).not.toHaveBeenCalled();
  });

  it("upper-cases and trims the lab code before inserting", async () => {
    getServerUserMock.mockResolvedValue(ADMIN_USER);
    userIsAdminMock.mockReturnValue(true);
    const builder = makeBuilder({ data: { id: "l-1", code: "LAB02", title: null }, error: null });
    fromQueue.push(builder);

    await createLabAction("  lab02  ", null);
    expect(builder.insert).toHaveBeenCalledWith({ code: "LAB02", title: null });
  });
});
