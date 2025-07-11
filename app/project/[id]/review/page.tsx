"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Project, Document } from '@prisma/client';
import { ArrowLeft, Wand2 } from 'lucide-react';
import Link from 'next/link';
import MarkdownRenderer from '@/components/MarkdownRenderer';

interface ProjectWithDocuments extends Project {
    documents: Document[];
}

export default function ReviewPage({ params }: { params: { id: string } }) {
    const router = useRouter();
    const projectId = params.id;
    const [project, setProject] = useState<ProjectWithDocuments | null>(null);
    const [loading, setLoading] = useState(true);
    const [vectorizing, setVectorizing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        async function fetchProject() {
            try {
                const response = await fetch(`/api/projects/${projectId}`);
                if (!response.ok) {
                    throw new Error('Failed to fetch project details');
                }
                const data = await response.json();
                setProject(data);
            } catch (err: any) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        }
        if (projectId) {
            fetchProject();
        }
    }, [projectId]);

    const handleVectorize = async () => {
        setVectorizing(true);
        setError(null);
        try {
            const response = await fetch(`/api/projects/${projectId}/vectorize`, {
                method: 'POST',
            });
             if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || "Failed to start vectorization.");
            }
            // TODO: Handle streaming response for progress
            alert("Vectorization started successfully!");
            router.push(`/project/${projectId}`);
        } catch (err: any) {
            setError(err.message);
            setVectorizing(false);
        }
    };

    if (loading) {
        return <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white">Loading Chunks...</div>;
    }

    if (error) {
        return <div className="min-h-screen flex items-center justify-center bg-gray-900 text-red-500">Error: {error}</div>;
    }

    if (!project) {
         return <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white">Project not found.</div>;
    }

    return (
        <div className="min-h-screen bg-gray-900 text-white p-8">
            <div className="max-w-7xl mx-auto">
                 <Link href="/chunks" className="inline-flex items-center gap-2 text-gray-400 hover:text-white mb-6 transition-colors">
                    <ArrowLeft size={16} />
                    <span>Back to Setups</span>
                </Link>
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h1 className="text-4xl font-bold">{project.name}</h1>
                        <p className="text-gray-400">Review {project.documents.length} chunks before vectorization.</p>
                    </div>
                    <button
                        onClick={handleVectorize}
                        disabled={vectorizing}
                        className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-500 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                        <Wand2 size={18} />
                        {vectorizing ? 'Vectorizing...' : 'Vectorize All Chunks'}
                    </button>
                </div>

                <div className="bg-gray-800 rounded-lg shadow-lg overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-gray-700 text-xs text-gray-400 uppercase">
                                <tr>
                                    <th scope="col" className="px-6 py-3">#</th>
                                    <th scope="col" className="px-6 py-3">Content</th>
                                    <th scope="col" className="px-6 py-3">Metadata</th>
                                </tr>
                            </thead>
                            <tbody>
                                {project.documents.map((doc, index) => (
                                    <tr key={doc.id.toString()} className="border-b border-gray-700 hover:bg-gray-700/50">
                                        <td className="px-6 py-4 font-medium">{index + 1}</td>
                                                                                <td className="px-6 py-4">
                                            <div className="w-full">
                                                <MarkdownRenderer
                                                    content={doc.content}
                                                    className="prose-sm prose-invert max-w-none"
                                                />
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <pre className="text-xs bg-gray-900 p-2 rounded max-h-24 overflow-y-auto">
                                                {JSON.stringify(doc.metadata, null, 2)}
                                            </pre>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}