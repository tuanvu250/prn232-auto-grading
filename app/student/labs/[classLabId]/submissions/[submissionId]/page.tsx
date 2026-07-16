import { redirect } from "next/navigation";

export default async function LegacySubmissionDetailPage({
  params,
}: {
  params: Promise<{ classLabId: string; submissionId: string }>;
}) {
  const { classLabId, submissionId } = await params;
  redirect(`/student/sessions/${classLabId}?submissionId=${submissionId}`);
}
