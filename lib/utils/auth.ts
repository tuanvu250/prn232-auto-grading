import Cookies from "js-cookie";

// Encode a string as Base64Url so jwt-decode can read it.
function base64UrlEncode(str: string): string {
  const base64 = btoa(
    encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, (_, p1) => {
      return String.fromCharCode(parseInt(p1, 16));
    })
  );
  return base64.replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

export interface UserPayload {
  email: string;
  name: string;
  picture?: string;
  role: string;
  studentId?: string;
  className?: string;
  exp: number;
}

/**
 * Create a mock JWT for local authentication.
 */
export function generateMockJWT(user: Omit<UserPayload, "exp">): string {
  const header = { alg: "HS256", typ: "JWT" };
  
  // Token expires after 7 days (UNIX timestamp in seconds).
  const exp = Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60;
  
  const payload: UserPayload = {
    ...user,
    exp,
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signature = base64UrlEncode("prn232-mock-signature-secret");

  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

/**
 * Store authToken in a cookie for middleware and client code.
 */
export function setAuthCookie(token: string) {
  Cookies.set("authToken", token, { expires: 7, path: "/" });
}

/**
 * Remove authToken from cookies on sign-out.
 */
export function removeAuthCookie() {
  Cookies.remove("authToken", { path: "/" });
}
