import { redirect } from "next/navigation";

export default async function LegacyClassLabsPage({
  params,
}: {
  params: Promise<{ termId: string; classId: string }>;
}) {
  const { termId, classId } = await params;
  redirect(`/admin/terms/${termId}/classes/${classId}/sessions`);
}
