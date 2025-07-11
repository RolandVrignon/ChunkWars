import { auth } from "@/auth";
import { AuthButtons } from "@/components/auth-buttons";
import { redirect } from "next/navigation";

export default async function WelcomePage() {
  const session = await auth();

  if (session?.user) {
    redirect("/chunks");
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 flex flex-col items-center justify-center py-10">
      <div className="w-full max-w-md px-4 text-center">
        <div className="flex flex-col items-center justify-center bg-white dark:bg-gray-800 p-8 rounded-lg shadow-md">
          <h1 className="text-3xl font-bold mb-2">Welcome to Chunk Wars</h1>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Sign in to start managing your projects.
          </p>
          <AuthButtons />
        </div>
      </div>
    </div>
  );
}
