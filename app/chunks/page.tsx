"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Project, ProjectStatus } from "@prisma/client";
import { AuthButtons } from "@/components/auth-buttons";
import { useSession } from "next-auth/react";
import { redirect } from "next/navigation";
import { Swords, Eye } from "lucide-react";

type BattlegroundMode = "none" | "retrieval" | "chunk";

interface ProjectWithStatus extends Project {
  status: ProjectStatus;
}

export default function ChunksPage() {
  const { status } = useSession();
  const [projects, setProjects] = useState<ProjectWithStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [battlegroundMode, setBattlegroundMode] =
    useState<BattlegroundMode>("none");
  const [selectedProjects, setSelectedProjects] = useState<bigint[]>([]);

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
    if (status === 'unauthenticated') redirect('/');
    if (status === 'authenticated') fetchProjects();
  }, [status]);

  const handleDelete = async (projectId: bigint, projectName: string) => {
    if (window.confirm(`Are you sure you want to delete the setup "${projectName}"? This action is irreversible.`)) {
      try {
        const response = await fetch(`/api/projects/${projectId}`, {
          method: 'DELETE',
        });
        if (!response.ok) {
          throw new Error('Failed to delete setup');
        }
        fetchProjects();
      } catch (error) {
        console.error("Delete error:", error);
        alert("Failed to delete the setup.");
      }
    }
  };

  const handleSelectProject = (
    project: ProjectWithStatus,
    mode: BattlegroundMode
  ) => {
    if (selectedProjects.includes(project.id)) {
      setSelectedProjects((prev) => prev.filter((id) => id !== project.id));
      return;
    }
    if (selectedProjects.length >= 3) {
      alert("You can select up to 3 projects for comparison.");
      return;
    }

    if (mode === "retrieval" && project.status !== "COMPLETED") {
      alert("Only vectorized projects can be compared in Retrieval Battleground.");
      return;
    }
    setSelectedProjects((prev) => [...prev, project.id]);
  };

  const startBattleground = (mode: BattlegroundMode) => {
    setBattlegroundMode(mode);
    setSelectedProjects([]);
  };

  const cancelBattleground = () => {
    setBattlegroundMode("none");
    setSelectedProjects([]);
  };

  if (status === 'loading' || loading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  const isBattlegroundActive = battlegroundMode !== "none";

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 py-10">
      <div className="w-full max-w-6xl px-4 mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-4xl font-bold">Chunk Setups</h1>
          <div className="flex items-center gap-4">
            {isBattlegroundActive ? (
              <button
                onClick={cancelBattleground}
                className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white"
              >
                Cancel Battle
              </button>
            ) : (
              <>
                <button
                  onClick={() => startBattleground("retrieval")}
                  className="px-4 py-2 rounded-lg bg-gray-600 hover:bg-gray-700 text-white flex items-center gap-2"
                >
                  <Swords size={16} /> Retrieval Battleground
                </button>
            <button
                  onClick={() => startBattleground("chunk")}
                  className="px-4 py-2 rounded-lg bg-gray-600 hover:bg-gray-700 text-white flex items-center gap-2"
            >
                  <Eye size={16} /> Chunk Battleground
            </button>
              </>
            )}
            <Link
              href="/projects/new"
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              + New Chunk Setup
            </Link>
            <AuthButtons />
          </div>
        </div>

        {isBattlegroundActive && (
          <div className="bg-blue-100 border-l-4 border-blue-500 text-blue-700 p-4 mb-6 rounded-md">
            <p className="font-bold">
              {battlegroundMode === "retrieval"
                ? "Retrieval Battleground"
                : "Chunk Battleground"}
            </p>
            <p>
              Select up to 3 chunk setups to compare. {selectedProjects.length}{" "}
              / 3 selected.
            </p>
            {selectedProjects.length >= 2 && (
              <Link
                href={
                  battlegroundMode === "retrieval"
                    ? `/compare?pids=${selectedProjects.join(",")}`
                    : `/chunk-compare?pids=${selectedProjects.join(",")}`
                }
                className="mt-2 inline-block bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
              >
                Start Comparison
              </Link>
            )}
          </div>
        )}

        {projects.length === 0 ? (
          <div className="text-center bg-white dark:bg-gray-800 p-8 rounded-lg shadow-md">
            <h2 className="text-2xl font-semibold mb-4">No setups found</h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Get started by creating your first chunk setup.
            </p>
            <Link
              href="/projects/new"
              className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 inline-block"
            >
              Create a Setup
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {projects.map((project) => {
              const isSelected = selectedProjects.includes(project.id);
              const isSelectable =
                battlegroundMode === "chunk" ||
                (battlegroundMode === "retrieval" &&
                  project.status === "COMPLETED");

              return (
              <div
                key={project.id.toString()}
                  className={`bg-white dark:bg-gray-800 rounded-lg shadow-md flex flex-col transition-all
                                ${
                                  isBattlegroundActive && "cursor-pointer"
                                }
                                ${isSelected && "ring-2 ring-blue-500"}
                                ${
                                  battlegroundMode === "retrieval" &&
                                  project.status !== "COMPLETED" &&
                                  "opacity-50 cursor-not-allowed"
                                }`}
                  onClick={
                    isBattlegroundActive && isSelectable
                      ? () => handleSelectProject(project, battlegroundMode)
                      : undefined
                  }
              >
                  <div
                    className={`block p-6 flex-grow ${
                      isBattlegroundActive ? "pointer-events-none" : ""
                    }`}
                >
                    <div className="flex justify-between items-start">
                  <h3 className="text-xl font-bold mb-2">{project.name}</h3>
                      <span
                        className={`text-xs font-semibold px-2 py-1 rounded-full ${
                          {
                            PENDING: "bg-yellow-200 text-yellow-800",
                            PROCESSING: "bg-blue-200 text-blue-800 animate-pulse",
                            COMPLETED: "bg-green-200 text-green-800",
                          }[project.status]
                        }`}
                      >
                        {project.status}
                      </span>
                    </div>
                  <p className="text-sm text-gray-500">
                    Model: {project.embedding_model}
                  </p>
                  <p className="text-sm text-gray-400 mt-2">
                      Created on:{" "}
                      {new Date(project.createdAt).toLocaleDateString()}
                  </p>
                  </div>
                  <div className="border-t border-gray-200 dark:border-gray-700 p-3 flex justify-end">
                    <Link
                      href={`/project/${project.id}/review`}
                      className="text-xs text-blue-500 hover:text-blue-700 font-semibold mr-4"
                    >
                      View Chunks
                </Link>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(project.id, project.name);
                      }}
                      className="text-xs text-red-500 hover:text-red-700 font-semibold"
                    >
                      Delete
                    </button>
                </div>
              </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}