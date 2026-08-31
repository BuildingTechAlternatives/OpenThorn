import { useState, useEffect } from 'react'
import { useParams, Link, Navigate } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { getPostBySlug, type BlogPost } from '../data/blogPosts'
import { fetchPublishedPosts } from '../lib/blog'
import { splitMarkdownForAd } from '../lib/ad-placement'
import AdsterraNativeBanner from '../components/AdsterraNativeBanner/AdsterraNativeBanner'
import { usePageTitle } from '../lib/usePageTitle'
import { useJsonLd } from '../lib/useJsonLd'
import styles from './BlogPostPage.module.css'

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

const markdownComponents = {
  h1: ({ children }: { children?: React.ReactNode }) => <h1 className={styles.h1}>{children}</h1>,
  h2: ({ children }: { children?: React.ReactNode }) => <h2 className={styles.h2}>{children}</h2>,
  h3: ({ children }: { children?: React.ReactNode }) => <h3 className={styles.h3}>{children}</h3>,
  p: ({ children }: { children?: React.ReactNode }) => <p className={styles.p}>{children}</p>,
  a: ({ href, children }: { href?: string; children?: React.ReactNode }) => (
    <a href={href} className={styles.a} target={href?.startsWith('http') ? '_blank' : undefined} rel="noopener noreferrer">
      {children}
    </a>
  ),
  ul: ({ children }: { children?: React.ReactNode }) => <ul className={styles.ul}>{children}</ul>,
  ol: ({ children }: { children?: React.ReactNode }) => <ol className={styles.ol}>{children}</ol>,
  li: ({ children }: { children?: React.ReactNode }) => <li className={styles.li}>{children}</li>,
  code: ({ children, className }: { children?: React.ReactNode; className?: string }) => {
    const isBlock = className?.includes('language-')
    return isBlock
      ? <code className={styles.codeBlock}>{children}</code>
      : <code className={styles.codeInline}>{children}</code>
  },
  pre: ({ children }: { children?: React.ReactNode }) => <pre className={styles.pre}>{children}</pre>,
  hr: () => <hr className={styles.hr} />,
  blockquote: ({ children }: { children?: React.ReactNode }) => (
    <blockquote className={styles.blockquote}>{children}</blockquote>
  ),
}

function estimateReadTime(content: string) {
  const words = content.trim().split(/\s+/).length
  return Math.max(1, Math.ceil(words / 200))
}

export default function BlogPostPage() {
  const { slug } = useParams<{ slug: string }>()
  // Start from the bundled post (matches prerendered SSR for hydration), then
  // refetch from Supabase so edits and newly published posts appear without a
  // rebuild. A post published since the last build isn't bundled, so we hold
  // off the not-found redirect until the fetch resolves.
  const [post, setPost] = useState<BlogPost | undefined>(slug ? getPostBySlug(slug) : undefined)
  const [resolving, setResolving] = useState(!post)

  useEffect(() => {
    let cancelled = false
    if (!slug) return
    fetchPublishedPosts().then((all) => {
      if (cancelled || !all) { setResolving(false); return }
      const fresh = all.find((p) => p.slug === slug)
      if (fresh) setPost(fresh)
      setResolving(false)
    })
    return () => { cancelled = true }
  }, [slug])

  usePageTitle(post?.title, post ? { description: post.excerpt, image: post.ogImage } : undefined)

  useJsonLd(
    post
      ? {
          '@context': 'https://schema.org',
          '@type': 'BlogPosting',
          headline: post.title,
          description: post.excerpt,
          datePublished: post.date,
          dateModified: post.dateModified ?? post.date,
          url: `https://www.openthorn.app/blog/${post.slug}`,
          author: { '@type': 'Organization', name: 'OpenThorn' },
          publisher: {
            '@type': 'Organization',
            name: 'OpenThorn',
            logo: {
              '@type': 'ImageObject',
              url: 'https://www.openthorn.app/logo.png',
            },
          },
          image: post.ogImage ?? 'https://www.openthorn.app/og-card.png',
        }
      : {}
  )

  useJsonLd(
    post
      ? {
          '@context': 'https://schema.org',
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://www.openthorn.app/' },
            { '@type': 'ListItem', position: 2, name: 'Blog', item: 'https://www.openthorn.app/blog' },
            { '@type': 'ListItem', position: 3, name: post.title },
          ],
        }
      : {}
  )

  useJsonLd(
    post?.howTo
      ? {
          '@context': 'https://schema.org',
          '@type': 'HowTo',
          name: post.howTo.name,
          step: post.howTo.steps.map((s, i) => ({
            '@type': 'HowToStep',
            position: i + 1,
            name: s.name,
            text: s.text,
          })),
        }
      : post?.itemList
        ? {
            '@context': 'https://schema.org',
            '@type': 'ItemList',
            itemListElement: post.itemList.map((name, i) => ({
              '@type': 'ListItem',
              position: i + 1,
              name,
            })),
          }
        : {}
  )

  if (!post) {
    if (resolving) return <div className={styles.page} />
    return <Navigate to="/blog" replace />
  }

  // Ad sits on the section boundary closest to ~35% of the body; short posts
  // get no ad at all rather than a forced slot.
  const [intro, rest] = splitMarkdownForAd(post.content) ?? [post.content, null]

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <Link to="/blog" className={styles.back}>← All posts</Link>

        <header className={styles.header}>
          <h1 className={styles.title}>{post.title}</h1>
          <div className={styles.meta}>
            <time>{formatDate(post.date)}</time>
            {post.dateModified && post.dateModified !== post.date && (
              <>
                <span className={styles.dot}>·</span>
                <span>Updated <time dateTime={post.dateModified}>{formatDate(post.dateModified)}</time></span>
              </>
            )}
            <span className={styles.dot}>·</span>
            <span>{estimateReadTime(post.content)} min read</span>
          </div>
        </header>

        {post.coverYoutube && (
          <iframe
            className={styles.video}
            src={`https://www.youtube-nocookie.com/embed/${post.coverYoutube}`}
            title="Video"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        )}

        {!post.coverYoutube && post.coverImage && (
          <img className={styles.cover} src={post.coverImage} alt="" />
        )}

        {post.tldr && (
          <aside className={styles.tldr}>
            <span className={styles.tldrLabel}>TL;DR</span>
            <p>{post.tldr}</p>
          </aside>
        )}

        <article className={styles.article}>
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
            {intro}
          </ReactMarkdown>
          {rest && (
            <>
              <AdsterraNativeBanner variant="inline" />
              <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                {rest}
              </ReactMarkdown>
            </>
          )}
        </article>
      </div>
    </div>
  )
}
