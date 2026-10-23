import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET as adminUsersGet, POST as adminUsersPost } from "@/app/api/admin/users/route";
import { POST as academicTermsPost } from "@/app/api/admin/academic/terms/route";
import { getServerSession } from "next-auth";

vi.mock("next-auth", () => ({
  getServerSession: vi.fn(),
}));

describe("2.f - Penegakan RBAC Tingkat HTTP pada Route Handler Admin", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("Panggilan admin route handler dengan sesi GURU (TEACHER) HARUS 403 Ditolak", async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce({
      user: {
        id: "teacher-user-1",
        activeRole: "TEACHER",
        activeInstitutionId: "poltekmi-id",
      },
    } as any);

    const req = new Request("http://localhost:3000/api/admin/users", { method: "GET" });
    const res = await adminUsersGet(req);

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toContain("Akses ditolak");
  });

  it("Panggilan admin route handler dengan sesi SISWA (STUDENT) HARUS 403 Ditolak", async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce({
      user: {
        id: "student-user-1",
        activeRole: "STUDENT",
        activeInstitutionId: "poltekmi-id",
      },
    } as any);

    const req = new Request("http://localhost:3000/api/admin/users", { method: "GET" });
    const res = await adminUsersGet(req);

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toContain("Akses ditolak");
  });

  it("Panggilan admin route handler dengan sesi KEUANGAN (FINANCE) HARUS 403 Ditolak", async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce({
      user: {
        id: "finance-user-1",
        activeRole: "FINANCE",
        activeInstitutionId: "poltekmi-id",
      },
    } as any);

    const req = new Request("http://localhost:3000/api/admin/users", { method: "GET" });
    const res = await adminUsersGet(req);

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toContain("Akses ditolak");
  });

  it("Panggilan admin mutasi (POST term) dengan sesi GURU (TEACHER) HARUS 403 Ditolak", async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce({
      user: {
        id: "teacher-user-1",
        activeRole: "TEACHER",
        activeInstitutionId: "poltekmi-id",
      },
    } as any);

    const req = new Request("http://localhost:3000/api/admin/academic/terms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Semester 1", code: "SEM-1" }),
    });
    const res = await academicTermsPost(req);

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toContain("Akses ditolak");
  });

  it("Panggilan tanpa sesi aktif (Unauthenticated) HARUS 401 Unauthorized", async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce(null);

    const req = new Request("http://localhost:3000/api/admin/users", { method: "GET" });
    const res = await adminUsersGet(req);

    expect(res.status).toBe(401);
  });
});
