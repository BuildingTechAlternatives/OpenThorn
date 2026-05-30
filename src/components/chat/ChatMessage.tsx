import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeSanitize from 'rehype-sanitize'
import type { ContentBlock } from './ChatPanel'
import ToolExecutionCard from './ToolExecutionCard'
import styles from './ChatMessage.module.css'

interface Message {
  id: string
  role: 'user' | 'assistant'
  text: string
  blocks?: ContentBlock[]
}

interface Props {
  message: Message
  streaming?: boolean
}

export type { Message, ContentBlock }

export default function ChatMessage({ message, streaming }: Props) {
  const isUser = message.role === 'user'
  const isGenerating = streaming && !isUser

  return (
    <div className={`${styles.row} ${isUser ? styles.user : styles.ai}`}>
      <div className={styles.bubble}>
        {/* Render blocks chronologically — text, file cards, status interleaved */}
        {message.blocks && message.blocks.length > 0 ? (
          <div className={styles.blocks}>
            {message.blocks.map((block, i) => {
              switch (block.type) {
                case 'text':
                  return block.content ? (
                    <div key={i} className={`${styles.content} ${styles.markdown}`}>
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        rehypePlugins={[rehypeSanitize]}
                      >
                        {block.content}
                      </ReactMarkdown>
                    </div>
                  ) : null

                case 'tool':
                  return block.tool && block.toolResult ? (
                    <ToolExecutionCard
                      key={i}
                      tool={block.tool}
                      args={block.toolArgs}
                      result={block.toolResult}
                      success={block.toolSuccess ?? true}
                    />
                  ) : null

                case 'file_change':
                  return block.action && block.path ? (
                    <ToolExecutionCard
                      key={i}
                      tool="write_file"
                      args={{ path: block.path }}
                      result={`${block.icon} ${block.action} ${block.path}`}
                      success={true}
                    />
                  ) : null

                case 'status':
                  return block.content ? (
                    <div key={i} className={styles.status}>
                      {block.content}
                    </div>
                  ) : null

                default:
                  return null
              }
            })}
          </div>
        ) : (
          /* Fallback for messages without blocks (user messages, welcome) */
          message.text && (
            <div
              className={`${styles.content} ${!isUser ? styles.markdown : ''}`}
            >
              {isUser ? (
                message.text
              ) : (
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  rehypePlugins={[rehypeSanitize]}
                >
                  {message.text}
                </ReactMarkdown>
              )}
            </div>
          )
        )}

        {/* Copy button — only on AI messages that finished generating */}
        {!isUser && !isGenerating && message.text && (
          <div className={styles.actions}>
            <button
              className={styles.actionBtn}
              title="Copy"
              onClick={() => navigator.clipboard.writeText(message.text)}
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </svg>
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
