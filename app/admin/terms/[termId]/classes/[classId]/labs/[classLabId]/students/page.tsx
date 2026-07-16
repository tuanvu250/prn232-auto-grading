import { redirect } from "next/navigation";

export default async function LegacySessionStudentsPage({
  params,
}: {
  params: Promise<{ termId: string; classId: string; classLabId: string }>;
}) {
  const { termId, classId, classLabId } = await params;
  redirect(`/admin/terms/${termId}/classes/${classId}/sessions/${classLabId}/students`);
}
