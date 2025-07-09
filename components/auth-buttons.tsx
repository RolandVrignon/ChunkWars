"use client";

import { signIn, signOut } from "next-auth/react";
import { useSession } from "next-auth/react";

export function AuthButtons() {
  const { data: session } = useSession();

  if (session) {
    return (
      <button
        onClick={() => signOut()}
        className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
      >
        Sign Out
      </button>
    );
  }
  return (
    <button
      onClick={() => signIn("google")}
      className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center justify-center space-x-2"
    >
      {/* You can add a Google icon here if you wish */}
      <span>Sign in with Google</span>
    </button>
  );
}