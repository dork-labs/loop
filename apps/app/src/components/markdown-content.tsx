import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypePrettyCode from 'rehype-pretty-code'

export function MarkdownContent({ content }: { content: string }) {
  if (!content) return null

  return (
    <div className="prose prose-invert max-w-none">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[[rehypePrettyCode, { theme: 'github-dark' }]]}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}
