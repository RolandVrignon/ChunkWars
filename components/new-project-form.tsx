"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { EmbeddingModel } from "@prisma/client";

export default function NewProjectForm() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [projectName, setProjectName] = useState("");
  const [model, setModel] = useState<EmbeddingModel>("openai_text_embedding_3_small");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [progressText, setProgressText] = useState("");

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFile(e.target.files[0]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !projectName) {
      setError("Le nom du projet et le fichier CSV sont requis.");
      return;
    }
    setLoading(true);
    setError(null);
    setProgress(0);
    setProgressText("");

    const formData = new FormData();
    formData.append("file", file);
    formData.append("projectName", projectName);
    formData.append("model", model);

    try {
      const response = await fetch("/api/projects", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
         const errorText = await response.text();
         throw new Error(errorText || "Une erreur est survenue lors de la création.");
      }

      if (!response.body) {
        throw new Error("La réponse du serveur ne contient pas de stream.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          setProgressText("Traitement terminé ! Redirection...");
          router.push("/rag");
          router.refresh();
          break;
        }

        const chunk = decoder.decode(value);
        const lines = chunk.split("\n\n").filter(line => line.startsWith("data:"));

        for (const line of lines) {
          const jsonString = line.replace("data: ", "");
          const data = JSON.parse(jsonString);

          if (data.type === 'start') {
            setProgressText(`Initialisation... 0 / ${data.total} lignes.`);
          } else if (data.type === 'progress') {
            const percentage = Math.round((data.processed / data.total) * 100);
            setProgress(percentage);
            setProgressText(`Traitement... ${data.processed} / ${data.total} lignes.`);
          } else if (data.type === 'done') {
            setProgress(100);
          }
        }
      }

    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("An unknown error occurred");
      }
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 py-10">
      <div className="w-full max-w-2xl px-4 mx-auto">
        <h1 className="text-4xl font-bold text-center mb-8">Nouveau Projet</h1>
        <form
          onSubmit={handleSubmit}
          className="bg-white dark:bg-gray-800 p-8 rounded-lg shadow-md space-y-6"
        >
          {loading ? (
            <div className="text-center">
                <h3 className="text-xl font-semibold mb-4">Création de votre projet...</h3>
                <div className="w-full bg-gray-200 rounded-full h-4 dark:bg-gray-700">
                    <div
                        className="bg-blue-600 h-4 rounded-full transition-all duration-500"
                        style={{ width: `${progress}%` }}
                    ></div>
                </div>
                <p className="text-sm text-gray-500 mt-2">{progressText}</p>
            </div>
          ) : (
            <>
              <div>
                <label htmlFor="projectName" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Nom du projet
                </label>
                <input
                  id="projectName"
                  type="text"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  placeholder="Mon super projet RAG"
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label htmlFor="model" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Modèle d&apos;embedding
                </label>
                <select
                  id="model"
                  value={model}
                  onChange={(e) => setModel(e.target.value as EmbeddingModel)}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="openai_text_embedding_3_small">OpenAI - text-embedding-3-small</option>
                  <option value="openai_text_embedding_3_large">OpenAI - text-embedding-3-large</option>
                  <option value="openai_text_embedding_ada_002">OpenAI - text-embedding-ada-002</option>
                </select>
              </div>

              <div>
                <label htmlFor="file" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Fichier CSV
                </label>
                 <input
                  id="file"
                  type="file"
                  accept=".csv"
                  onChange={handleFileChange}
                  className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                  required
                />
                <p className="text-xs text-gray-500 mt-2">
                  Le CSV doit contenir une colonne &quot;chunk&quot; pour le contenu à vectoriser. Les autres colonnes seront stockées dans les métadonnées.
                </p>
              </div>

              {error && <p className="text-red-500 text-center">{error}</p>}

              <button
                type="submit"
                disabled={loading || !file || !projectName}
                className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-300 disabled:cursor-not-allowed"
              >
                Créer le projet et vectoriser
              </button>
            </>
          )}
        </form>
      </div>
    </div>
  );
}