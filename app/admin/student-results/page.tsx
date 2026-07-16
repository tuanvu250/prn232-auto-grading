"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Superseded by the id-based term -> class -> lab -> student navigation at
// /admin/terms (Phase 5). This route used to pick class/lab by free-text string
// match against the legacy allowed_emails/submissions tables; kept as a redirect
// (not deleted outright) so any bookmarked link still lands somewhere useful.
export default function AdminStudentResultsRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/admin/terms");
  }, [router]);

  return null;
}
