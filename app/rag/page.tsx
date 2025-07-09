"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Project } from "@prisma/client";
import { AuthButtons } from "@/components/auth-buttons";
import { useSession } from "next-auth/react";
import { redirect } from "next/navigation";

export default function RagPage() {
  const { status } = useSession();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchProjects = async () => {
    try {
      const response = await fetch("/api/projects");
      if (!response.ok) throw new Error("Failed to fetch projects");
      const data = await response.json();
      setProjects(data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (status === 'unauthenticated') {
      redirect('/');
    }
    if (status === 'authenticated') {
      fetchProjects();
    }
  }, [status]);

  const handleDelete = async (projectId: bigint, projectName: string) => {
    if (window.confirm(`Êtes-vous sûr de vouloir supprimer le projet "${projectName}" ? Cette action est irréversible.`)) {
      try {
        const response = await fetch(`/api/projects/${projectId}`, {
          method: 'DELETE',
        });
        if (!response.ok) {
          throw new Error('Failed to delete project');
        }
        // Refresh the list of projects
        fetchProjects();
      } catch (error) {
        console.error("Delete error:", error);
        alert("La suppression du projet a échoué.");
      }
    }
  };


  if (status === 'loading' || loading) {
    return <div className="min-h-screen flex items-center justify-center">Chargement...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 py-10">
      <div className="w-full max-w-4xl px-4 mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-4xl font-bold">Mes Projets</h1>
          <div className="flex items-center gap-4">
            <Link
              href="/projects/new"
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              + Nouveau Projet
            </Link>
            <AuthButtons />
          </div>
        </div>

        {projects.length === 0 ? (
          <div className="text-center bg-white dark:bg-gray-800 p-8 rounded-lg shadow-md">
            <h2 className="text-2xl font-semibold mb-4">Aucun projet trouvé</h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Commencez par créer votre premier projet d&apos;embedding.
            </p>
            <Link
              href="/projects/new"
              className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 inline-block"
            >
              Créer un projet
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {projects.map((project) => (
              <div key={project.id} className="bg-white dark:bg-gray-800 rounded-lg shadow-md flex flex-col">
                <Link
                  href={`/project/${project.id}`}
                  className="block p-6 flex-grow"
                >
                  <h3 className="text-xl font-bold mb-2">{project.name}</h3>
                  <p className="text-sm text-gray-500">
                    Modèle: {project.embedding_model}
                  </p>
                  <p className="text-sm text-gray-400 mt-2">
                    Créé le: {new Date(project.createdAt).toLocaleDateString()}
                  </p>
                </Link>
                <div className="border-t border-gray-200 dark:border-gray-700 p-3 flex justify-end">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(project.id, project.name);
                      }}
                      className="text-xs text-red-500 hover:text-red-700 font-semibold"
                    >
                      Supprimer
                    </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}