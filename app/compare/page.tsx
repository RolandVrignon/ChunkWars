"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Project as PrismaProject } from "@prisma/client";
import MarkdownRenderer from "@/components/MarkdownRenderer";

interface Project extends PrismaProject {
  _count: {
    documents: number;
  };
}

interface SearchResult {
  id: string;
  content: string;
  similarity: number;
  metadata: JSON;
}

type CompareResults = { [projectId: string]: SearchResult[] };

function ComparePageComponent() {
  const searchParams = useSearchParams();
  const projectIds = searchParams.get("pids")?.split(",") || [];

  const [projectDetails, setProjectDetails] = useState<Project[]>([]);
  const [results, setResults] = useState<CompareResults>({});
  const [query, setQuery] = useState("");
  const [matchCount, setMatchCount] = useState(10);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchProjectDetails() {
      if (projectIds.length > 0) {
        setLoading(true);
        try {
          const details = await Promise.all(
            projectIds.map(id => fetch(`/api/projects/${id}`).then(res => res.json()))
          );
          setProjectDetails(details);
        } catch {
          setError("Failed to fetch project details.");
        } finally {
          setLoading(false);
        }
      }
    }
    fetchProjectDetails();
  }, [projectIds]);

  const handleSearch = async () => {
    if (!query) return;
    setLoading(true);
    setError(null);
    setResults({});

    try {
      const searchPromises = projectIds.map(id =>
        fetch(`/api/search`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query, projectId: Number(id), matchCount }),
        }).then(res => {
            if (!res.ok) throw new Error(`Search failed for project ${id}`);
            return res.json();
        })
      );

      const searchResults = await Promise.all(searchPromises);

      const newResults: CompareResults = {};
      projectIds.forEach((id, index) => {
        newResults[id] = searchResults[index];
      });
      setResults(newResults);

    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "An error occurred during search.");
    } finally {
      setLoading(false);
    }
  };

  return (
     <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 py-10">
      <div className="w-full max-w-7xl px-4 mx-auto">
        <Link href="/chunks" className="text-blue-500 hover:underline mb-4 block">&larr; Back</Link>
        <h1 className="text-4xl font-bold mb-8">RAG Battleground ⚔️</h1>

        <div className="sticky top-4 bg-gray-100 dark:bg-gray-800 p-4 rounded-lg shadow-md mb-8 z-10">
            <div className="flex items-center space-x-4">
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Your unique search query..."
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
                  disabled={loading || !query}
                  className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-green-300"
                >
                  {loading ? "Searching..." : "Search"}
                </button>
            </div>
             {error && <p className="text-red-500 mt-2 text-center">{error}</p>}
        </div>

        <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-${projectIds.length} gap-6`}>
            {projectDetails.map((project) => (
                <div key={project.id.toString()} className="bg-gray-100 dark:bg-gray-800 p-4 rounded-lg flex flex-col">
                    <div className="text-center mb-4">
                      <h2 className="text-xl font-bold">{project.name}</h2>
                      <div className="text-xs text-gray-400">
                          <span>{project._count.documents} chunks</span>
                          <span className="mx-2">&bull;</span>
                          <span>{project.embedding_model.replace('openai_', '').replace(/_/g, '-')}</span>
                      </div>
                    </div>
                    <div className="space-y-4 overflow-y-auto">
                        {(results[project.id.toString()] || []).map(result => (
                           <div key={result.id} className="bg-white dark:bg-gray-700 p-3 rounded-lg shadow">
                              <div className="flex justify-between items-start">
                                <div className="flex-1 pr-2 text-sm">
                                  <MarkdownRenderer
                                    content={result.content}
                                    className="prose-sm max-w-none dark:prose-invert"
                                  />
                                </div>
                                <span className="text-xs font-semibold text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-800/50 px-2 py-1 rounded-md whitespace-nowrap">
                                  {Math.round(result.similarity * 100)}%
                                </span>
                              </div>
                              <details className="mt-2 text-xs text-gray-400 cursor-pointer">
                                  <summary className="outline-none">Show metadata</summary>
                                  <pre className="mt-1 p-2 bg-gray-200 dark:bg-gray-600 rounded text-xs overflow-auto">
                                    {JSON.stringify(result.metadata, null, 2)}
                                  </pre>
                              </details>
                            </div>
                        ))}
                         {loading && <p className="text-center text-sm">Loading...</p>}
                    </div>
                </div>
            ))}
        </div>
      </div>
    </div>
  );
}

export default function ComparePage() {
    return (
        <Suspense fallback={<div>Loading comparison page...</div>}>
            <ComparePageComponent />
        </Suspense>
    )
}