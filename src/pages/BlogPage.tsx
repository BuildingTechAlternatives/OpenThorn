import { Link } from 'react-router-dom'
import { blogPosts } from '../data/blogPosts'
import styles from './BlogPage.module.css'

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

export default function BlogPage() {
  const [featured, ...rest] = blogPosts

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <header className={styles.header}>
          <h1 className={styles.title}>Blog</h1>
          <p className={styles.subtitle}>Product updates, guides, and behind-the-scenes from the OpenThorn team.</p>
        </header>

        {featured && (
          <Link to={`/blog/${featured.slug}`} className={styles.featured}>
            {featured.coverVideo && (
              <video
                className={styles.featuredVideo}
                src={featured.coverVideo}
                muted
                playsInline
                preload="metadata"
              />
            )}
            <div className={styles.featuredBody}>
              <time className={styles.date}>{formatDate(featured.date)}</time>
              <h2 className={styles.featuredTitle}>{featured.title}</h2>
              <p className={styles.excerpt}>{featured.excerpt}</p>
              <span className={styles.readMore}>Read article →</span>
            </div>
          </Link>
        )}

        {rest.length > 0 && (
          <div className={styles.grid}>
            {rest.map((post) => (
              <Link key={post.slug} to={`/blog/${post.slug}`} className={styles.card}>
                <time className={styles.date}>{formatDate(post.date)}</time>
                <h3 className={styles.cardTitle}>{post.title}</h3>
                <p className={styles.excerpt}>{post.excerpt}</p>
                <span className={styles.readMore}>Read article →</span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
