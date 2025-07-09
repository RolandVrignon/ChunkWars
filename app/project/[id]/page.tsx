"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Project } from "@prisma/client";

interface SearchResult {
  id: number;
  content: string;
  similarity: number;
  metadata: { [key: string]: string };
}

interface ProjectDetails extends Project {
  _count: {
    documents: number;
  };
}

export default function ProjectPage() {
  const params = useParams();
  const projectId = params.id as string;

  const [project, setProject] = useState<ProjectDetails | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [newName, setNewName] = useState("");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [matchCount, setMatchCount] = useState(10);
  const [loadingProject, setLoadingProject] = useState(true);
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (projectId) {
      async function fetchProjectDetails() {
        try {
          const response = await fetch(`/api/projects/${projectId}`);
          if (!response.ok) {
            throw new Error("Failed to fetch project details");
          }
          const data = await response.json();
          setProject(data);
        } catch (err) {
          if (err instanceof Error) {
            setError(err.message);
          } else {
            setError("An unknown error occurred while fetching project details.");
          }
        } finally {
          setLoadingProject(false);
        }
      }
      fetchProjectDetails();
    }
  }, [projectId]);

  const handleRenameStart = () => {
    if (!project) return;
    setIsEditing(true);
    setNewName(project.name);
  };

  const handleRenameCancel = () => {
    setIsEditing(false);
    setNewName("");
  };

  const handleRenameSave = async () => {
    if (!newName || !project || newName === project.name) {
      setIsEditing(false);
      return;
    }

    try {
      const response = await fetch(`/api/projects/${projectId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to rename project.');
      }

      setProject(prev => prev ? { ...prev, name: data.name } : null);
      setIsEditing(false);

    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("An unknown error occurred while renaming.");
      }
      // Ne pas annuler l'édition pour que l'utilisateur puisse voir l'erreur et réessayer
    }
  };

  const handleSearch = async () => {
    if (!query || !projectId) {
      setError("La requête est requise.");
      return;
    }
    setLoadingSearch(true);
    setError(null);
    setResults([]);

    try {
      const response = await fetch(`/api/search`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, projectId: Number(projectId), matchCount }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Une erreur est survenue lors de la recherche.");
      }
      setResults(data);
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("An unknown error occurred during search.");
      }
    } finally {
      setLoadingSearch(false);
    }
  };

  if (loadingProject) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        Chargement du projet...
      </div>
    );
  }

  if (!project) {
    return (
        <div className="min-h-screen flex flex-col items-center justify-center">
            <h2 className="text-2xl font-bold text-red-500">Projet introuvable</h2>
            <p className="text-gray-400">Ce projet n&apos;existe pas ou vous n&apos;y avez pas accès.</p>
            <Link href="/" className="mt-4 text-blue-500 hover:underline">&larr; Retour à l&apos;accueil</Link>
        </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 py-10">
      <div className="w-full max-w-4xl px-4 mx-auto">
        <Link href="/rag" className="text-blue-500 hover:underline mb-4 block">&larr; Retour à tous les projets</Link>

        <div className="mb-8">
            <div className="flex items-center gap-4">
              {isEditing ? (
                <>
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="text-4xl font-bold bg-transparent border-b-2 border-gray-400 focus:outline-none focus:border-blue-500"
                  />
                  <button onClick={handleRenameSave} className="px-3 py-1 bg-green-600 text-white rounded-lg text-sm">Sauvegarder</button>
                  <button onClick={handleRenameCancel} className="px-3 py-1 bg-gray-500 text-white rounded-lg text-sm">Annuler</button>
                </>
              ) : (
                <>
                  <h1 className="text-4xl font-bold">{project.name}</h1>
                  <button onClick={handleRenameStart} className="text-sm text-blue-500 hover:underline">Renommer</button>
                </>
              )}
            </div>
            <div className="text-sm text-gray-400 flex items-center gap-4 mt-2">
                <span>Parmi {project._count.documents} chunks</span>
                <span>&bull;</span>
                <span>{`Modèle : ${project.embedding_model.replace(/_/g, ' ').replace('openai text embedding', 'OpenAI Text Embedding')}`}</span>
            </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md mb-8">
          <div className="flex items-center space-x-4">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Votre requête..."
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
             <select
              value={matchCount}
              onChange={(e) => setMatchCount(Number(e.target.value))}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value={5}>5</option>
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
            </select>
            <button
              onClick={handleSearch}
              disabled={loadingSearch || !query}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-green-300"
            >
              {loadingSearch ? "Recherche..." : "Rechercher"}
            </button>
          </div>
        </div>

        {error && <p className="text-red-500 mt-4 text-center">{error}</p>}

        <div className="mt-8">
          <h2 className="text-2xl font-semibold mb-4">Résultats ({results.length})</h2>
          <div className="space-y-4">
            {results.length > 0 ? (
              results.map((result) => (
                <div key={result.id} className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
                  <div className="flex justify-between items-start">
                    <p className="flex-1 pr-4">{result.content}</p>
                    <span className="text-sm font-semibold text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-800/50 px-2 py-1 rounded-md whitespace-nowrap">
                      Score: {Math.round(result.similarity * 100)}%
                    </span>
                  </div>
                  <details className="mt-2 text-xs text-gray-400">
                      <summary>Afficher les métadonnées</summary>
                      <pre className="mt-1 p-2 bg-gray-100 dark:bg-gray-700 rounded text-xs overflow-auto">
                        {JSON.stringify(result.metadata, null, 2)}
                      </pre>
                  </details>
                </div>
              ))
            ) : (
              <p className="text-gray-500 text-center">Aucun résultat à afficher. Lancez une recherche pour commencer.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}