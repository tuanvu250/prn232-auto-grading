"use client";

import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-8">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle>PRN232 Auto Grading</CardTitle>
          <CardDescription>
            Frontend foundation — Tailwind v4, Redux, React Query, shadcn UI
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button onClick={() => toast.success("Setup hoàn tất!")}>Test toast</Button>
          <Button variant="outline" asChild>
            <Link href="/login">Đăng nhập</Link>
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
