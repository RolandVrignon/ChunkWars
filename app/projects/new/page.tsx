"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { redirect } from "next/navigation";
import {
  Upload,
  FileText,
  Settings,
  BrainCircuit,
  Scissors,
  Wand2,
  ArrowRight,
  ArrowLeft,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { EmbeddingModel, Document } from "@prisma/client";
import Link from "next/link";

type ChunkingStrategy =
  | "simple"
  | "mistral_ocr"
  | "contextualized"
  | "recursive"
  | "semantic";

export default function NewProjectPage() {
  const { status } = useSession({
    required: true,
    onUnauthenticated() {
    redirect("/api/auth/signin?callbackUrl=/projects/new");
    },
  });

  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"import" | "template">("import");

  // Common state
  const [projectName, setProjectName] = useState("");
  const [model, setModel] = useState<EmbeddingModel>(
    "openai_text_embedding_3_small"
  );
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<{
    status: string;
    chunks: Document[];
  }>({ status: "Starting...", chunks: [] });

  // Template-specific state
  const [selectedTemplate, setSelectedTemplate] =
    useState<ChunkingStrategy>("recursive");
  const [chunkSize, setChunkSize] = useState(512);
  const [overlap, setOverlap] = useState(50);
  const [annotateImages, setAnnotateImages] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!file || !projectName) {
      setError("Project name and file are required.");
      return;
    }
    setLoading(true);
    setError(null);
    setProgress({ status: "Preparing...", chunks: [] });

    let finalProjectName = projectName;
    if (activeTab === "template") {
      const template = templates.find((t) => t.id === selectedTemplate);
      if (template) {
        finalProjectName = `${projectName} - ${template.name}`;
      }
    }

    try {
      const formData = new FormData();
      let documentUrl = "";

      // Handle file upload
      if (activeTab === "template") {
        setProgress(prev => ({ ...prev, status: "Generating secure upload link..."}));
        console.log("1. Requesting pre-signed URL for:", { filename: file.name, contentType: file.type });
        // 1. Get pre-signed URL from our API
        const presignedResponse = await fetch('/api/s3-upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filename: file.name, contentType: file.type }),
        });

        if (!presignedResponse.ok) {
          const errorText = await presignedResponse.text();
          console.error("FRONTEND: Pre-signed URL request failed:", errorText);
          throw new Error(`Failed to get pre-signed URL: ${errorText}`);
        }

        const { uploadUrl, viewUrl } = await presignedResponse.json();
        console.log("FRONTEND: 2. Received URLs:", { uploadUrl, viewUrl });

        // 2. Upload file directly to S3
        setProgress(prev => ({ ...prev, status: `Uploading ${file.name} to storage...`}));
        console.log("FRONTEND: 3. Starting file upload to S3...", {
          url: uploadUrl,
          method: 'PUT',
          fileSize: file.size,
          fileType: file.type
        });

        try {
          const uploadResponse = await fetch(uploadUrl, {
              method: 'PUT',
              body: file,
              headers: {
                'Content-Type': file.type
              }
          });

          console.log("FRONTEND: 3.1. Upload response received:", {
            status: uploadResponse.status,
            statusText: uploadResponse.statusText,
            ok: uploadResponse.ok,
            headers: Object.fromEntries(uploadResponse.headers.entries())
          });

          if (!uploadResponse.ok) {
            const errorText = await uploadResponse.text();
            console.error("FRONTEND: S3 upload failed:", {
              status: uploadResponse.status,
              statusText: uploadResponse.statusText,
              errorText
            });
            throw new Error(`Failed to upload file to S3: ${uploadResponse.status} - ${errorText}`);
          }
          console.log("FRONTEND: 4. ✅ File uploaded successfully to S3!");
        } catch (uploadError) {
          console.error("FRONTEND: Upload error caught:", uploadError);
          throw uploadError;
        }

        documentUrl = viewUrl;
        formData.append("documentUrl", documentUrl);
      } else {
        formData.append("file", file);
      }

      formData.append("projectName", finalProjectName);
      formData.append("model", model);

      // Append strategy-specific data if using a template
      if (activeTab === "template") {
        formData.append("strategy", selectedTemplate);
        formData.append("chunkSize", String(chunkSize));
        formData.append("overlap", String(overlap));
        formData.append("annotateImages", String(annotateImages));
      }

      const response = await fetch("/api/projects", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Failed to create project: ${response.status} - ${errorText}`
        );
      }

      if (!response.body) throw new Error("The response body is empty.");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let finalProjectId = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const eventLines = chunk.split("data: ").filter((line) => line.trim());

        for (const line of eventLines) {
          try {
            const eventData = JSON.parse(line);
            if (eventData.type === "status") {
              setProgress((prev) => ({ ...prev, status: eventData.message }));
            } else if (eventData.type === "chunk") {
              setProgress((prev) => ({
                ...prev,
                chunks: [...prev.chunks, eventData.data],
              }));
            } else if (eventData.type === "done") {
              finalProjectId = eventData.projectId;
            }
          } catch (e) {
            console.error("Failed to parse stream event", line, e);
          }
        }
      }

      router.push(`/project/${finalProjectId}/review`);
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("An unexpected error occurred.");
      }
      setLoading(false);
    }
  };

  const renderTemplateOptions = () => {
    switch (selectedTemplate) {
      case "simple":
      case "recursive":
        return (
          <div className="space-y-4">
            <label className="block">
              <span className="text-gray-400">Tokens per Chunk</span>
              <input type="number" value={chunkSize} onChange={e => setChunkSize(Number(e.target.value))} className="mt-1 block w-full bg-gray-700 border-gray-600 rounded-md shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50 px-3 py-2" />
            </label>
            <label className="block">
              <span className="text-gray-400">Overlap Tokens</span>
              <input type="number" value={overlap} onChange={e => setOverlap(Number(e.target.value))} className="mt-1 block w-full bg-gray-700 border-gray-600 rounded-md shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50 px-3 py-2" />
            </label>
          </div>
        );
      case "mistral_ocr":
        return (
           <label className="flex items-center">
            <input type="checkbox" checked={annotateImages} onChange={e => setAnnotateImages(e.target.checked)} className="rounded bg-gray-700 border-gray-600 text-indigo-600 shadow-sm focus:border-indigo-300 focus:ring focus:ring-offset-0 focus:ring-indigo-200 focus:ring-opacity-50"/>
            <span className="ml-2 text-gray-400">Annotate Images</span>
          </label>
        );
      case "contextualized":
      case "semantic":
         return (
          <div className="text-center text-gray-500 bg-gray-800 p-4 rounded-md">
            <Wand2 className="mx-auto h-8 w-8 mb-2 text-indigo-400"/>
            <p>This advanced strategy requires powerful LLM processing.</p>
            <p className="text-xs mt-1">Parameters will be configurable in a future version.</p>
          </div>
        );
      default:
        return null;
    }
  };

  const templates = [
    { id: "recursive", icon: Scissors, name: "Recursive Overlap", description: "Recursively splits text by paragraphs and sentences to maintain semantic integrity." },
    { id: "simple", icon: FileText, name: "Simple Overlap", description: "Creates new chunks of a fixed token size with a defined overlap." },
    { id: "mistral_ocr", icon: BrainCircuit, name: "Mistral OCR to Markdown", description: "Extracts text from PDFs, preserving layout and adding parent titles to each chunk for context." },
    { id: "contextualized", icon: Wand2, name: "Contextualized Chunks", description: "Uses an LLM to rewrite each chunk with the full document's context." },
    { id: "semantic", icon: Settings, name: "Semantic Chunking", description: "Groups sentences by semantic similarity for highly relevant chunks." },
  ];

  if (status === 'loading') {
    return <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white">Loading session...</div>;
  }

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-900 text-white p-8">
        <div className="w-full max-w-2xl text-center">
          <h2 className="text-2xl font-bold mb-2 text-indigo-400">Processing Document</h2>
          <p className="text-gray-400 mb-6 font-mono bg-gray-800 p-2 rounded">{progress.status}</p>

          <div className="bg-gray-800 rounded-lg shadow-lg overflow-hidden h-96 flex flex-col">
            <div className="overflow-y-auto p-4 text-left">
              {progress.chunks.map((chunk, index) => (
                <div key={index} className="text-xs font-mono border-b border-gray-700 py-2 animate-fade-in">
                  <span className="text-green-400 mr-2">CHUNK {index + 1}:</span>
                  <span className="text-gray-300">{chunk.content?.substring(0, 100) ?? '[Empty Content]'}...</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-4xl mx-auto">
        <Link href="/chunks" className="inline-flex items-center gap-2 text-gray-400 hover:text-white mb-6 transition-colors">
          <ArrowLeft size={16} />
          <span>Back to Setups</span>
        </Link>
        <h1 className="text-4xl font-bold mb-2">Create New Chunk Setup</h1>
        <p className="text-gray-400 mb-8">Choose how to prepare your documents for retrieval.</p>

        <form onSubmit={handleSubmit}>
          <div className="bg-gray-800 p-6 rounded-lg mb-6">
            <h2 className="text-xl font-semibold mb-4">1. General Setup</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <label className="block">
                <span className="text-gray-400">Project Name</span>
                <input type="text" value={projectName} onChange={e => setProjectName(e.target.value)} placeholder="e.g., Q3 Financial Report" className="mt-1 block w-full bg-gray-700 border-gray-600 rounded-md shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50 px-3 py-2" />
              </label>
              <label className="block">
                <span className="text-gray-400">Embedding Model</span>
                <select value={model} onChange={e => setModel(e.target.value as EmbeddingModel)} className="mt-1 block w-full bg-gray-700 border-gray-600 rounded-md shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50 px-3 py-2">
                  <option value="openai_text_embedding_3_small">OpenAI - text-embedding-3-small</option>
                  <option value="openai_text_embedding_3_large">OpenAI - text-embedding-3-large</option>
                  <option value="openai_text_embedding_ada_002">OpenAI - text-embedding-ada-002</option>
                </select>
              </label>
            </div>
          </div>

          <div className="bg-gray-800 p-6 rounded-lg mb-6">
            <h2 className="text-xl font-semibold mb-4">2. Choose Your Data Source</h2>
            <div className="flex border-b border-gray-700 mb-6">
              <button type="button" onClick={() => setActiveTab("import")} className={`py-2 px-4 flex items-center gap-2 cursor-pointer ${activeTab === 'import' ? 'border-b-2 border-indigo-500 text-white' : 'text-gray-400'}`}>
                <Upload size={18} /> Import Pre-chunked CSV
              </button>
              <button type="button" onClick={() => setActiveTab("template")} className={`py-2 px-4 flex items-center gap-2 cursor-pointer ${activeTab === 'template' ? 'border-b-2 border-indigo-500 text-white' : 'text-gray-400'}`}>
                <Wand2 size={18} /> Use a Chunking Template
              </button>
            </div>

            {activeTab === 'import' && (
              <div>
                <h3 className="text-lg font-medium mb-2">Upload your CSV</h3>
                <p className="text-sm text-gray-500 mb-4">The file must contain a &apos;chunk&apos; column. Other columns will be saved as metadata.</p>
                <input type="file" onChange={e => setFile(e.target.files ? e.target.files[0] : null)} accept=".csv" className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 cursor-pointer"/>
              </div>
            )}

            {activeTab === 'template' && (
              <div>
                <h3 className="text-lg font-medium mb-4">Select a Document and a Chunking Strategy</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <p className="text-sm text-gray-500 mb-4">Upload a document (e.g., PDF, TXT, MD) to apply the chunking strategy.</p>
                    <input type="file" onChange={e => setFile(e.target.files ? e.target.files[0] : null)} accept=".pdf,.txt,.md" className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 cursor-pointer"/>
                  </div>
                  <div className="space-y-4">
                    {templates.map(t => (
                      <div key={t.id} onClick={() => setSelectedTemplate(t.id as ChunkingStrategy)} className={`p-4 rounded-lg cursor-pointer border-2 ${selectedTemplate === t.id ? 'border-indigo-500 bg-gray-700' : 'border-gray-600 bg-gray-800 hover:bg-gray-700'}`}>
                        <div className="flex items-center gap-3">
                          <t.icon size={20} className="text-indigo-400"/>
                          <h4 className="font-semibold">{t.name}</h4>
                        </div>
                        <p className="text-xs text-gray-400 mt-1 ml-8">{t.description}</p>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="mt-6 border-t border-gray-700 pt-6">
                  <h3 className="text-lg font-medium mb-4">Strategy Parameters</h3>
                  {renderTemplateOptions()}
                </div>
              </div>
            )}
          </div>

          {error && <p className="text-red-500 text-sm mb-4 text-center">{error}</p>}

          <div className="flex justify-end">
            <button type="submit" disabled={loading || !file || !projectName} className="px-8 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-500 disabled:cursor-not-allowed flex items-center gap-2">
              {loading ? "Processing..." : "Create Setup"} <ArrowRight size={18} />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}