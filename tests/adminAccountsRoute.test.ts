import { NextRequest } from "next/server";

import { createSessionToken, SESSION_COOKIE } from "@/lib/auth/session";

const mocks = vi.hoisted(() => ({
  listAdminAccounts: vi.fn(),
  deactivateAccount: vi.fn(),
}));

vi.mock("@/lib/auth/adminAccounts", () => {
  class AdminAccountActionError extends Error {
    status: number;

    constructor(message: string, status: number) {
      super(message);
      this.status = status;
    }
  }

  return {
    AdminAccountActionError,
    listAdminAccounts: mocks.listAdminAccounts,
    deactivateAccount: mocks.deactivateAccount,
  };
});

import { AdminAccountActionError } from "@/lib/auth/adminAccounts";
import { DELETE, GET } from "@/app/api/admin/accounts/route";

function sessionCookie(username: string, role: "admin" | "user") {
  const token = createSessionToken({ username, role });
  return `${SESSION_COOKIE}=${token}`;
}

describe("admin accounts route", () => {
  beforeAll(() => {
    process.env.DATAGEN_SESSION_SECRET = "admin-route-secret";
  });

  beforeEach(() => {
    mocks.listAdminAccounts.mockReset();
    mocks.deactivateAccount.mockReset();
  });

  it("returns 401 when unauthenticated", async () => {
    const request = new NextRequest("http://localhost/api/admin/accounts", {
      method: "GET",
    });
    const response = await GET(request);
    expect(response.status).toBe(401);
  });

  it("returns 403 for non-admin users", async () => {
    const request = new NextRequest("http://localhost/api/admin/accounts", {
      method: "GET",
      headers: { cookie: sessionCookie("alice", "user") },
    });
    const response = await GET(request);
    expect(response.status).toBe(403);
  });

  it("lists accounts for admin users", async () => {
    mocks.listAdminAccounts.mockResolvedValueOnce([
      {
        username: "admin",
        email: "admin@datagems.test",
        country: "Romania",
      },
    ]);

    const request = new NextRequest("http://localhost/api/admin/accounts", {
      method: "GET",
      headers: { cookie: sessionCookie("admin", "admin") },
    });
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(Array.isArray(data.accounts)).toBe(true);
    expect(mocks.listAdminAccounts).toHaveBeenCalledTimes(1);
  });

  it("deletes account for admin users", async () => {
    mocks.deactivateAccount.mockResolvedValueOnce(undefined);

    const request = new NextRequest("http://localhost/api/admin/accounts", {
      method: "DELETE",
      headers: {
        cookie: sessionCookie("admin", "admin"),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ username: "bob" }),
    });
    const response = await DELETE(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(mocks.deactivateAccount).toHaveBeenCalledWith({
      actorUsername: "admin",
      targetUsername: "bob",
    });
  });

  it("returns delete errors from backend validation", async () => {
    mocks.deactivateAccount.mockRejectedValueOnce(
      new AdminAccountActionError("You cannot delete your own account", 400),
    );

    const request = new NextRequest("http://localhost/api/admin/accounts", {
      method: "DELETE",
      headers: {
        cookie: sessionCookie("admin", "admin"),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ username: "admin" }),
    });
    const response = await DELETE(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain("cannot delete your own account");
  });
});
