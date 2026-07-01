import { cookies } from "next/headers";
import { jwtDecode } from "jwt-decode";

import { ROLE_ADMIN } from "@/lib/types/roles";

export interface ServerUserPayload {
  email: string;
  name?: string;
  picture?: string;
  role: string;
  studentId?: string;
  className?: string;
  exp?: number;
}

export function getAdminEmails() {
  return (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export function isAdminEmail(email?: string | null) {
  if (!email) return false;
  return getAdminEmails().includes(email.trim().toLowerCase());
}

export function userIsAdmin(user: ServerUserPayload) {
  return user.role === ROLE_ADMIN && isAdminEmail(user.email);
}

export async function getServerUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get("authToken")?.value;

  if (!token) return null;

  try {
    const decoded = jwtDecode<ServerUserPayload>(token);
    if (decoded.exp && decoded.exp < Math.floor(Date.now() / 1000)) return null;
    return decoded;
  } catch {
    return null;
  }
}
