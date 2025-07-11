import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize from 'rehype-sanitize';

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

export default function MarkdownRenderer({ content, className = '' }: MarkdownRendererProps) {
  return (
    <div className={`prose prose-slate max-w-none dark:prose-invert ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw, rehypeSanitize]}
        components={{
          // Custom styling for images
          img: ({ node, ...props }) => (
            <img
              {...props}
              className="rounded-lg shadow-md max-w-full h-auto"
              loading="lazy"
            />
          ),
          // Custom styling for tables
          table: ({ node, ...props }) => (
            <div className="overflow-x-auto">
              <table {...props} className="min-w-full divide-y divide-gray-200" />
            </div>
          ),
          // Custom styling for code blocks
          pre: ({ node, ...props }) => (
            <pre {...props} className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 overflow-x-auto" />
          ),
          // Custom styling for inline code
          code: ({ node, className, ...props }) => {
            const isInline = !className;
            return (
              <code
                {...props}
                className={
                  isInline
                    ? "bg-gray-100 dark:bg-gray-800 rounded px-1 py-0.5 text-sm font-mono"
                    : className
                }
              />
            );
          },
          // Custom styling for headings
          h1: ({ node, ...props }) => (
            <h1 {...props} className="text-3xl font-bold text-gray-900 dark:text-white mb-4 mt-8 first:mt-0" />
          ),
          h2: ({ node, ...props }) => (
            <h2 {...props} className="text-2xl font-semibold text-gray-800 dark:text-gray-100 mb-3 mt-6" />
          ),
          h3: ({ node, ...props }) => (
            <h3 {...props} className="text-xl font-medium text-gray-700 dark:text-gray-200 mb-2 mt-4" />
          ),
          // Custom styling for paragraphs with image annotations
          p: ({ node, children, ...props }) => {
            // Check if this paragraph contains an image with annotation (bracket text)
            const content = children?.toString() || '';
            const hasImageAnnotation = content.includes('[') && content.includes(']') && content.includes('![');

            if (hasImageAnnotation) {
              return (
                <div className="mb-6">
                  <p {...props} className="mb-2">{children}</p>
                  {/* Extract and style the annotation text */}
                  {content.match(/\[([^\]]+)\]/) && (
                    <div className="text-sm text-gray-600 dark:text-gray-400 italic bg-gray-50 dark:bg-gray-800 p-3 rounded-md">
                      📷 {content.match(/\[([^\]]+)\]/)?.[1]}
                    </div>
                  )}
                </div>
              );
            }

            return <p {...props} className="mb-4 leading-relaxed">{children}</p>;
          },
          // Custom styling for blockquotes
          blockquote: ({ node, ...props }) => (
            <blockquote {...props} className="border-l-4 border-blue-500 pl-4 py-2 bg-blue-50 dark:bg-blue-900/20 rounded-r-lg" />
          ),
          // Custom styling for lists
          ul: ({ node, ...props }) => (
            <ul {...props} className="list-disc list-inside space-y-1 mb-4" />
          ),
          ol: ({ node, ...props }) => (
            <ol {...props} className="list-decimal list-inside space-y-1 mb-4" />
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}