import { useParams, Link, Navigate } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { getPostBySlug } from '../data/blogPosts'
import styles from './BlogPostPage.module.css'

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

function estimateReadTime(content: string) {
  const words = content.trim().split(/\s+/).length
  return Math.max(1, Math.ceil(words / 200))
}

export default function BlogPostPage() {
  const { slug } = useParams<{ slug: string }>()
  const post = slug ? getPostBySlug(slug) : undefined

  if (!post) return <Navigate to="/blog" replace />

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <Link to="/blog" className={styles.back}>← All posts</Link>

        <header className={styles.header}>
          <h1 className={styles.title}>{post.title}</h1>
          <div className={styles.meta}>
            <time>{formatDate(post.date)}</time>
            <span className={styles.dot}>·</span>
            <span>{estimateReadTime(post.content)} min read</span>
          </div>
        </header>

        {post.coverVideo && (
          <video
            className={styles.video}
            src={post.coverVideo}
            controls
            playsInline
            preload="metadata"
          />
        )}

        <article className={styles.article}>
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              h1: ({ children }) => <h1 className={styles.h1}>{children}</h1>,
              h2: ({ children }) => <h2 className={styles.h2}>{children}</h2>,
              h3: ({ children }) => <h3 className={styles.h3}>{children}</h3>,
              p: ({ children }) => <p className={styles.p}>{children}</p>,
              a: ({ href, children }) => (
                <a href={href} className={styles.a} target={href?.startsWith('http') ? '_blank' : undefined} rel="noopener noreferrer">
                  {children}
                </a>
              ),
              ul: ({ children }) => <ul className={styles.ul}>{children}</ul>,
              ol: ({ children }) => <ol className={styles.ol}>{children}</ol>,
              li: ({ children }) => <li className={styles.li}>{children}</li>,
              code: ({ children, className }) => {
                const isBlock = className?.includes('language-')
                return isBlock
                  ? <code className={styles.codeBlock}>{children}</code>
                  : <code className={styles.codeInline}>{children}</code>
              },
              pre: ({ children }) => <pre className={styles.pre}>{children}</pre>,
              hr: () => <hr className={styles.hr} />,
              blockquote: ({ children }) => <blockquote className={styles.blockquote}>{children}</blockquote>,
            }}
          >
            {post.content}
          </ReactMarkdown>
        </article>
      </div>
    </div>
  )
}
