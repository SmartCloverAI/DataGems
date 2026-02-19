import { mockAuth } from "@/lib/ratio1/mock";

describe("mock auth login behavior", () => {
  it("authenticates admin/admin", async () => {
    const user = await mockAuth.simple.authenticate("admin", "admin");
    expect(user.username).toBe("admin");
  });

  it("accepts surrounding whitespace in mock password", async () => {
    const user = await mockAuth.simple.authenticate("admin", " admin ");
    expect(user.username).toBe("admin");
  });

  it("accepts shorthand credentials when entered as admin/admin", async () => {
    const user = await mockAuth.simple.authenticate("admin/admin", "admin/admin");
    expect(user.username).toBe("admin");
  });
});
