"use client";

import { useState, useEffect, Suspense, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { Project, Document } from '@prisma/client';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import MarkdownRenderer from '@/components/MarkdownRenderer';

interface ProjectWithDocuments extends Project {
    documents: Document[];
    _count: {
        documents: number;
    }
}

function ChunkComparePageComponent() {
    const searchParams = useSearchParams();
    const projectIds = useMemo(() => 
        searchParams.get('pids')?.split(',') || [], 
        [searchParams]
    );
    const [projects, setProjects] = useState<ProjectWithDocuments[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        async function fetchProjects() {
            if (projectIds.length > 0) {
                setLoading(true);
                try {
                    const details = await Promise.all(
                        projectIds.map(id => fetch(`/api/projects/${id}`).then(res => {
                            if (!res.ok) throw new Error(`Failed to fetch project ${id}`);
                            return res.json();
                        }))
                    );
                    setProjects(details);
                } catch (err: unknown) {
                    const errorMessage = err instanceof Error ? err.message : 'An error occurred';
                    setError(errorMessage);
                } finally {
                    setLoading(false);
                }
            } else {
                setLoading(false);
            }
        }
        fetchProjects();
    }, [projectIds]);

    if (loading) return <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white">Loading project chunks...</div>;
    if (error) return <div className="min-h-screen flex items-center justify-center bg-gray-900 text-red-500">Error: {error}</div>;

    return (
        <div className="min-h-screen bg-gray-900 text-white p-8">
            <div className="max-w-full mx-auto">
                <Link href="/chunks" className="inline-flex items-center gap-2 text-gray-400 hover:text-white mb-6 transition-colors">
                    <ArrowLeft size={16} />
                    <span>Back to Setups</span>
                </Link>
                <h1 className="text-4xl font-bold mb-8 text-center">Chunk Comparison</h1>

                <div className={`grid grid-cols-1 md:grid-cols-${projects.length} gap-6`}>
                    {projects.map((project) => (
                        <div key={project.id.toString()} className="bg-gray-800 p-4 rounded-lg flex flex-col h-full max-h-[85vh]">
                            <div className="text-center mb-4 sticky top-0 bg-gray-800 py-2">
                                <h2 className="text-xl font-bold">{project.name}</h2>
                                <div className="text-xs text-gray-400">
                                    <span>{project._count.documents} chunks</span>
                                    <span className="mx-2">&bull;</span>
                                    <span>{project.embedding_model.replace('openai_', '').replace(/_/g, '-')}</span>
                                </div>
                            </div>
                                                        <div className="space-y-4 overflow-y-auto pr-2">
                                {project.documents.map((doc) => (
                                    <div key={doc.id.toString()} className="bg-gray-700 p-3 rounded-lg shadow">
                                        <div className="flex-1 pr-2 text-sm">
                                            <MarkdownRenderer
                                                content={doc.content || ''}
                                                className="prose-sm prose-invert max-w-none"
                                            />
                                        </div>
                                        {doc.metadata && Object.keys(doc.metadata).length > 0 && (
                                            <details className="mt-2 text-xs text-gray-400 cursor-pointer">
                                                <summary className="outline-none">Show metadata</summary>
                                                <pre className="mt-1 p-2 bg-gray-900 rounded text-xs overflow-auto">
                                                    {JSON.stringify(doc.metadata, null, 2)}
                                                </pre>
                                            </details>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}


export default function ChunkComparePage() {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <ChunkComparePageComponent />
        </Suspense>
    );
}