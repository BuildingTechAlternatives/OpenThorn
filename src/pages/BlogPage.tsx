import { Link } from 'react-router-dom'
import { blogPosts } from '../data/blogPosts'
import { usePageTitle } from '../lib/usePageTitle'
import styles from './BlogPage.module.css'

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

export default function BlogPage() {
  usePageTitle('Blog', {
    description: 'Product updates, guides, and stories from the OpenThorn team on building and shipping websites with AI.',
  })
  const [featured, ...rest] = blogPosts

  return (
    <div className={styles.page}>
      <div className={styles.ambient} />

      <div className={styles.container}>
        <header className={styles.header}>
          <span className={styles.eyebrow}>From the team</span>
          <h1 className={styles.title}>Blog</h1>
          <div className={styles.rule} />
        </header>

        {featured && (
          <Link to={`/blog/${featured.slug}`} className={styles.featured}>
            <div className={styles.featuredContent}>
              <div className={styles.featuredMeta}>
                <span className={styles.tag}>Latest</span>
                <time className={styles.date}>{formatDate(featured.date)}</time>
              </div>
              <h2 className={styles.featuredTitle}>{featured.title}</h2>
              <p className={styles.excerpt}>{featured.excerpt}</p>
              <span className={styles.cta}>
                Read article
                <svg className={styles.ctaArrow} width="18" height="18" viewBox="0 0 18 18" fill="none">
                  <path d="M3.5 9h11M10 4.5L14.5 9 10 13.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
            </div>

            {featured.coverVideo && (
              <div className={styles.featuredMedia}>
                <video
                  className={styles.featuredVideo}
                  src={`${featured.coverVideo}#t=2`}
                  muted
                  playsInline
                  preload="metadata"
                  aria-hidden="true"
                />
                <div className={styles.videoGlow} />
              </div>
            )}

            {!featured.coverVideo && featured.coverImage && (
              <div className={styles.featuredMedia}>
                <img
                  className={styles.featuredVideo}
                  src={featured.coverImage}
                  alt=""
                  aria-hidden="true"
                />
                <div className={styles.videoGlow} />
              </div>
            )}
          </Link>
        )}

        {rest.length > 0 && (
          <section className={styles.more}>
            <h3 className={styles.moreLabel}>More articles</h3>
            <div className={styles.grid}>
              {rest.map((post) => (
                <Link key={post.slug} to={`/blog/${post.slug}`} className={styles.card}>
                  {post.coverImage && (
                    <img className={styles.cardThumb} src={post.coverImage} alt="" loading="lazy" />
                  )}
                  <time className={styles.date}>{formatDate(post.date)}</time>
                  <h3 className={styles.cardTitle}>{post.title}</h3>
                  <p className={styles.excerpt}>{post.excerpt}</p>
                  <span className={styles.readMore}>Read →</span>
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  )
}
