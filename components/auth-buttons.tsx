"use client";

import { signIn, signOut, useSession } from "next-auth/react";

export function AuthButtons() {
  const { data: session } = useSession();

  if (session) {
    return (
      <button
        onClick={() => signOut()}
        className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
      >
        Se déconnecter
      </button>
    );
  }
  return (
    <button
      onClick={() => signIn("google")}
      className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center justify-center space-x-2"
    >
      {/* Vous pouvez ajouter une icône Google ici si vous le souhaitez */}
      <span>Se connecter avec Google</span>
    </button>
  );
}