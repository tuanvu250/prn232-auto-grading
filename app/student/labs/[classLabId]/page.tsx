import { redirect } from "next/navigation";

export default async function LegacyStudentLabPage({
  params,
}: {
  params: Promise<{ classLabId: string }>;
}) {
  const { classLabId } = await params;
  redirect(`/student/sessions/${classLabId}`);
}
