import type { Metadata } from "next";
import { Open_Sans, Quicksand } from "next/font/google";
import "./globals.css";
import { Providers } from "@/lib/providers";

const openSans = Open_Sans({
  subsets: ["latin", "vietnamese"],
  variable: "--font-open-sans",
  weight: ["300", "400", "500", "600", "700", "800"],
});

const quicksand = Quicksand({
  subsets: ["latin", "vietnamese"],
  variable: "--font-quicksand",
  weight: ["300", "400", "500", "600", "700"],
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "http://localhost:5173"),
  title: "PRN232 Auto Grading",
  description: "Hệ thống chấm điểm tự động PRN232",
  openGraph: {
    type: "website",
    locale: "vi_VN",
    title: "PRN232 Auto Grading",
    description: "Hệ thống chấm điểm tự động PRN232",
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi" suppressHydrationWarning>
      <body className={`${openSans.variable} ${quicksand.variable} min-h-full antialiased`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
