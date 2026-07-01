import Cookies from "js-cookie";

// Mã hóa chuỗi sang Base64Url tương thích với JWT-decode
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
 * Tạo token JWT giả lập cho việc xác thực cục bộ
 */
export function generateMockJWT(user: Omit<UserPayload, "exp">): string {
  const header = { alg: "HS256", typ: "JWT" };
  
  // Token hết hạn sau 7 ngày (UNIX timestamp bằng giây)
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
 * Lưu authToken vào Cookie để Middleware và Client đọc
 */
export function setAuthCookie(token: string) {
  Cookies.set("authToken", token, { expires: 7, path: "/" });
}

/**
 * Xóa authToken khỏi Cookie khi đăng xuất
 */
export function removeAuthCookie() {
  Cookies.remove("authToken", { path: "/" });
}
