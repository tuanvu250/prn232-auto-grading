import { redirect } from "next/navigation";

type PageProps = {
  params: Promise<{
    classLabId: string;
    submissionId: string;
  }>;
};

export default async function SubmissionDetailRedirectPage({ params }: PageProps) {
  const resolvedParams = await params;
  
  redirect(`/student/labs/${resolvedParams.classLabId}?submissionId=${resolvedParams.submissionId}`);
}