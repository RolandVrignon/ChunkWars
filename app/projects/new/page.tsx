import { auth } from "@/auth";
import NewProjectForm from "@/components/new-project-form";
import { redirect } from "next/navigation";

export default async function NewProjectPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/api/auth/signin?callbackUrl=/projects/new");
  }

  return <NewProjectForm />;
}