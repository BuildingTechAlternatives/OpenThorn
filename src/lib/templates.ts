import type { AgentCodeFile } from './agent'

export interface Template {
  id: string
  name: string
  description: string
  category: 'Portfolio' | 'SaaS' | 'E-commerce' | 'Restaurant' | 'Blog'
  highlights: string[]
  accentColor: string
  files: AgentCodeFile[]
}

export const TEMPLATES: Template[] = [
  creativePortfolio(),
  saasLanding(),
  ecommerceStorefront(),
  photographyStudio(),
  restaurantLanding(),
  techBlog(),
  wellnessClinic(),
  realEstateAgency(),
  conferenceEvent(),
]

// ─────────────────────────────────────────────────────────────────────────────
// Template 1: Creative Portfolio
// ─────────────────────────────────────────────────────────────────────────────
function creativePortfolio(): Template {
  return {
    id: 'creative-portfolio',
    name: 'Creative Portfolio',
    description: 'A dark, cinematic portfolio for designers and developers.',
    category: 'Portfolio',
    accentColor: '#7c6af7',
    highlights: [
      'Editorial hero with crisp service positioning',
      'Filterable case-study grid with real project imagery',
      'Skill groups with polished capability meters',
      'Accessible contact form with proof points',
    ],
    files: [
      {
        path: 'src/styles/theme.css',
        language: 'css',
        code: `*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
html{scroll-behavior:smooth}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',system-ui,sans-serif;background:#07070f;color:#ededf5;line-height:1.65;overflow-x:hidden}
a{color:inherit;text-decoration:none}
button{cursor:pointer;border:none;background:none;font:inherit;color:inherit}
::selection{background:rgba(124,106,247,.35)}

:root{
  --bg:#07070f;--surface:#0e0e1c;--surface-2:#17172c;
  --border:rgba(255,255,255,.08);--text:#ededf5;--muted:#7474a0;
  --accent:#7c6af7;--accent-2:#4facfe;--accent-glow:rgba(124,106,247,.3);
  --green:#34d399;--r:12px;--r-lg:20px;--r-xl:28px;
}

.navbar{position:fixed;top:0;left:0;right:0;z-index:100;height:64px;padding:0 2rem;display:flex;align-items:center;justify-content:space-between;transition:all .3s}
.navbar.scrolled{background:rgba(7,7,15,.88);backdrop-filter:blur(20px);border-bottom:1px solid var(--border)}
.nav-logo{font-weight:800;font-size:1.1rem;letter-spacing:-.02em}
.nav-logo-dot{color:var(--accent)}
.nav-links{display:flex;gap:2rem}
.nav-link{font-size:.875rem;color:var(--muted);transition:color .2s}
.nav-link:hover{color:var(--text)}
.nav-cta{padding:.5rem 1.25rem;background:var(--accent);color:#fff;border-radius:999px;font-size:.875rem;font-weight:600;transition:all .2s;box-shadow:0 0 20px var(--accent-glow)}
.nav-cta:hover{opacity:.85;transform:translateY(-1px)}

.hero{min-height:100vh;display:flex;align-items:center;justify-content:center;position:relative;overflow:hidden;padding:8rem 2rem 4rem;text-align:center}
.hero-orb{position:absolute;border-radius:50%;filter:blur(100px);pointer-events:none}
.hero-orb-1{width:700px;height:700px;background:radial-gradient(circle,rgba(124,106,247,.4),transparent 70%);top:-200px;left:-200px;animation:orbDrift1 12s ease-in-out infinite alternate}
.hero-orb-2{width:600px;height:600px;background:radial-gradient(circle,rgba(79,172,254,.3),transparent 70%);bottom:-200px;right:-100px;animation:orbDrift2 15s ease-in-out infinite alternate}
@keyframes orbDrift1{from{transform:translate(0,0)}to{transform:translate(80px,60px)}}
@keyframes orbDrift2{from{transform:translate(0,0)}to{transform:translate(-60px,-40px)}}
.hero-inner{position:relative;z-index:1;max-width:760px;margin:0 auto}
.hero-badge{display:inline-flex;align-items:center;gap:.5rem;padding:.35rem 1rem;margin-bottom:2rem;background:var(--surface-2);border:1px solid var(--border);border-radius:999px;font-size:.75rem;color:var(--muted);letter-spacing:.05em}
.hero-badge-dot{width:6px;height:6px;background:var(--green);border-radius:50%;animation:pulse 2s infinite}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}
.hero-name{font-size:clamp(3.5rem,9vw,6rem);font-weight:800;letter-spacing:-.04em;line-height:.95;margin-bottom:1rem;background:linear-gradient(135deg,var(--text) 40%,var(--accent) 100%);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}
.hero-role{font-size:clamp(1.1rem,2.5vw,1.5rem);font-weight:300;color:var(--muted);margin-bottom:1.5rem}
.hero-role em{color:var(--text);font-style:normal;font-weight:500}
.hero-desc{font-size:1rem;color:var(--muted);max-width:480px;margin:0 auto 2.5rem;line-height:1.75}
.hero-actions{display:flex;gap:1rem;justify-content:center;flex-wrap:wrap}
.btn-primary{padding:.875rem 2rem;background:var(--accent);color:#fff;border-radius:var(--r);font-weight:600;font-size:.95rem;transition:all .2s;display:inline-flex;align-items:center;gap:.5rem;box-shadow:0 4px 24px var(--accent-glow)}
.btn-primary:hover{opacity:.9;transform:translateY(-2px);box-shadow:0 8px 32px var(--accent-glow)}
.btn-ghost{padding:.875rem 2rem;color:var(--text);border:1px solid var(--border);border-radius:var(--r);font-weight:500;font-size:.95rem;transition:all .2s}
.btn-ghost:hover{border-color:var(--accent);color:var(--accent)}
.hero-scroll{position:absolute;bottom:2rem;left:50%;transform:translateX(-50%);display:flex;flex-direction:column;align-items:center;gap:.5rem;font-size:.7rem;letter-spacing:.1em;text-transform:uppercase;color:var(--muted)}
.hero-scroll-line{width:1px;height:48px;background:linear-gradient(to bottom,var(--muted),transparent)}

.section{padding:6rem 2rem}.container{max-width:1160px;margin:0 auto}
.section-eyebrow{font-size:.7rem;font-weight:700;letter-spacing:.15em;text-transform:uppercase;color:var(--accent);margin-bottom:.75rem}
.section-heading{font-size:clamp(1.8rem,3.5vw,2.75rem);font-weight:700;letter-spacing:-.03em;line-height:1.1;margin-bottom:.75rem}
.section-sub{font-size:1rem;color:var(--muted);max-width:460px;line-height:1.7}
.section-top{margin-bottom:3rem}

.filters{display:flex;gap:.5rem;flex-wrap:wrap;margin-bottom:2.5rem}
.filter-btn{padding:.4rem 1rem;border-radius:999px;font-size:.8rem;border:1px solid var(--border);color:var(--muted);transition:all .2s}
.filter-btn:hover{border-color:var(--accent);color:var(--accent)}
.filter-btn.active{background:var(--accent);border-color:var(--accent);color:#fff}
.projects-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:1.5rem}
.project-card{background:var(--surface);border:1px solid var(--border);border-radius:var(--r-lg);overflow:hidden;transition:all .3s;cursor:pointer}
.project-card:hover{transform:translateY(-6px);border-color:rgba(124,106,247,.4);box-shadow:0 20px 60px rgba(0,0,0,.5)}
.project-thumb{height:196px;display:flex;align-items:center;justify-content:center;font-size:3rem;position:relative;overflow:hidden}
.project-thumb-bg{position:absolute;inset:0}
.project-thumb-img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:0.55;mix-blend-mode:luminosity}
.project-thumb-icon{position:relative;z-index:1;filter:drop-shadow(0 4px 12px rgba(0,0,0,.4))}
.project-body{padding:1.25rem 1.5rem 1.5rem}
.project-tags{display:flex;gap:.4rem;flex-wrap:wrap;margin-bottom:.75rem}
.project-tag{font-size:.65rem;font-weight:700;letter-spacing:.06em;text-transform:uppercase;padding:.2rem .6rem;border-radius:4px;background:var(--surface-2);border:1px solid var(--border);color:var(--muted)}
.project-name{font-size:1.05rem;font-weight:600;margin-bottom:.4rem}
.project-desc{font-size:.85rem;color:var(--muted);line-height:1.6;margin-bottom:1rem}
.project-cta{font-size:.8rem;color:var(--accent);font-weight:600;display:inline-flex;align-items:center;gap:.3rem}

.skills-section{background:var(--surface)}
.skills-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:1.5rem;margin-top:3rem}
.skill-group{background:var(--bg);border:1px solid var(--border);border-radius:var(--r-lg);padding:1.5rem}
.skill-group-label{font-size:.65rem;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:var(--accent);margin-bottom:1.25rem}
.skill-item{margin-bottom:1rem}.skill-item:last-child{margin-bottom:0}
.skill-row{display:flex;justify-content:space-between;align-items:center;margin-bottom:.35rem}
.skill-name{font-size:.875rem}.skill-pct{font-size:.75rem;color:var(--muted)}
.skill-bar{height:3px;background:var(--surface-2);border-radius:2px;overflow:hidden}
.skill-fill{height:100%;border-radius:2px;background:linear-gradient(90deg,var(--accent),var(--accent-2))}

.contact-grid{display:grid;grid-template-columns:1fr 1fr;gap:5rem;margin-top:3rem}
.form-field{margin-bottom:1.25rem}
.form-label{display:block;font-size:.7rem;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--muted);margin-bottom:.5rem}
.form-input,.form-textarea{width:100%;padding:.75rem 1rem;background:var(--surface);border:1px solid var(--border);border-radius:var(--r);color:var(--text);font:inherit;font-size:.9rem;transition:border-color .2s,box-shadow .2s}
.form-input:focus,.form-textarea:focus{outline:none;border-color:var(--accent);box-shadow:0 0 0 3px var(--accent-glow)}
.form-textarea{height:128px;resize:vertical}
.contact-side{padding-top:.5rem}
.contact-side-title{font-size:1.1rem;font-weight:600;margin-bottom:.75rem}
.contact-side-text{font-size:.9rem;color:var(--muted);line-height:1.7;margin-bottom:2rem}
.socials{display:flex;flex-direction:column;gap:.75rem}
.social-item{display:flex;align-items:center;gap:.75rem;font-size:.9rem;color:var(--muted);transition:color .2s}
.social-item:hover{color:var(--text)}
.social-icon{width:36px;height:36px;background:var(--surface-2);border:1px solid var(--border);border-radius:var(--r);display:grid;place-items:center;font-size:1rem;flex-shrink:0}
.site-footer{padding:2rem;text-align:center;border-top:1px solid var(--border);font-size:.8rem;color:var(--muted)}

@media(max-width:768px){.nav-links{display:none}.contact-grid{grid-template-columns:1fr;gap:2.5rem}.skills-grid{grid-template-columns:1fr}.projects-grid{grid-template-columns:1fr}}`,
      },
      {
        path: 'src/App.tsx',
        language: 'tsx',
        code: `import Navbar from './components/Navbar'
import Hero from './components/Hero'
import Projects from './components/Projects'
import Skills from './components/Skills'
import Contact from './components/Contact'
import './styles/theme.css'

export default function App() {
  return (
    <div>
      <Navbar />
      <main>
        <Hero />
        <Projects />
        <Skills />
        <Contact />
      </main>
      <footer className="site-footer">© 2025 Alex Chen · Built with care</footer>
    </div>
  )
}`,
      },
      {
        path: 'src/components/Navbar.tsx',
        language: 'tsx',
        code: `import { useState, useEffect } from 'react'

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 50)
    window.addEventListener('scroll', fn)
    return () => window.removeEventListener('scroll', fn)
  }, [])
  return (
    <nav className={\`navbar\${scrolled ? ' scrolled' : ''}\`}>
      <a href="#" className="nav-logo"><span className="nav-logo-dot">◆</span> Alex Chen</a>
      <div className="nav-links">
        <a href="#work" className="nav-link">Work</a>
        <a href="#skills" className="nav-link">Skills</a>
        <a href="#contact" className="nav-link">Contact</a>
      </div>
      <a href="#contact" className="nav-cta">Hire me</a>
    </nav>
  )
}`,
      },
      {
        path: 'src/components/Hero.tsx',
        language: 'tsx',
        code: `export default function Hero() {
  return (
    <section className="hero" id="hero">
      <div className="hero-orb hero-orb-1" />
      <div className="hero-orb hero-orb-2" />
      <div className="hero-inner">
        <div className="hero-badge">
          <span className="hero-badge-dot" />
          Available for freelance work
        </div>
        <h1 className="hero-name">Alex Chen</h1>
        <p className="hero-role"><em>Full-stack developer</em> &amp; creative technologist</p>
        <p className="hero-desc">
          I design and ship polished digital products for teams that care about speed, clarity, and craft - from first prototype to production launch.
        </p>
        <div className="hero-actions">
          <a href="#work" className="btn-primary">View my work →</a>
          <a href="#contact" className="btn-ghost">Get in touch</a>
        </div>
      </div>
      <div className="hero-scroll">
        <div className="hero-scroll-line" />
        scroll
      </div>
    </section>
  )
}`,
      },
      {
        path: 'src/components/Projects.tsx',
        language: 'tsx',
        code: `import { useState } from 'react'

const PROJECTS = [
  { name: 'Phantom Analytics', desc: 'Revenue intelligence workspace with live cohort reports and executive-ready data stories.', tags: ['React', 'Node', 'Charts'], cat: 'Web', img: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=900&q=80&auto=format&fit=crop', bg: 'linear-gradient(135deg,#1a1a3e,#2d1b69)' },
  { name: 'Orbit Design System', desc: 'Multi-brand component library and documentation hub for five distributed product teams.', tags: ['Design', 'TypeScript', 'Storybook'], cat: 'Design', img: 'https://images.unsplash.com/photo-1586717791821-3f44a563fa4c?w=900&q=80&auto=format&fit=crop', bg: 'linear-gradient(135deg,#0f2027,#2c5364)' },
  { name: 'FlowCast Mobile', desc: 'Premium podcast app with transcription, chapter summaries, and offline listening.', tags: ['React Native', 'AI', 'Audio'], cat: 'Mobile', img: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=900&q=80&auto=format&fit=crop', bg: 'linear-gradient(135deg,#16213e,#0f3460)' },
  { name: 'NovaPay Gateway', desc: 'Secure payments console for high-volume finance teams and operations analysts.', tags: ['Go', 'Stripe', 'Postgres'], cat: 'Web', img: 'https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=900&q=80&auto=format&fit=crop', bg: 'linear-gradient(135deg,#0d1b2a,#1b4332)' },
  { name: 'Lumina Portfolio', desc: 'Immersive gallery system for an editorial photographer with rich case-study pages.', tags: ['Design', 'Motion', 'CMS'], cat: 'Design', img: 'https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?w=900&q=80&auto=format&fit=crop', bg: 'linear-gradient(135deg,#1a1a2e,#0f3460)' },
  { name: 'Halo Fitness', desc: 'Mobile training companion with habit plans, progress insights, and coach messaging.', tags: ['React Native', 'ML', 'HealthKit'], cat: 'Mobile', img: 'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=900&q=80&auto=format&fit=crop', bg: 'linear-gradient(135deg,#1c0a00,#4a1503)' },
]
const FILTERS = ['All', 'Web', 'Design', 'Mobile']

export default function Projects() {
  const [active, setActive] = useState('All')
  const filtered = active === 'All' ? PROJECTS : PROJECTS.filter(p => p.cat === active)
  return (
    <section className="section" id="work">
      <div className="container">
        <div className="section-top">
          <p className="section-eyebrow">Selected work</p>
          <h2 className="section-heading">Recent client work</h2>
          <p className="section-sub">Selected launches across SaaS, commerce, design systems, and mobile products.</p>
        </div>
        <div className="filters">
          {FILTERS.map(f => (
            <button key={f} className={\`filter-btn\${active === f ? ' active' : ''}\`} onClick={() => setActive(f)} type="button">{f}</button>
          ))}
        </div>
        <div className="projects-grid">
          {filtered.map(p => (
            <div key={p.name} className="project-card">
              <div className="project-thumb">
                <div className="project-thumb-bg" style={{ background: p.bg }} />
                <img className="project-thumb-img" src={p.img} alt={p.name} />
              </div>
              <div className="project-body">
                <div className="project-tags">{p.tags.map(t => <span key={t} className="project-tag">{t}</span>)}</div>
                <h3 className="project-name">{p.name}</h3>
                <p className="project-desc">{p.desc}</p>
                <span className="project-cta">View case study →</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}`,
      },
      {
        path: 'src/components/Skills.tsx',
        language: 'tsx',
        code: `const GROUPS = [
  { label: 'Frontend', skills: [{ name: 'React / Next.js', pct: 95 }, { name: 'TypeScript', pct: 92 }, { name: 'CSS / Animation', pct: 90 }, { name: 'Three.js / WebGL', pct: 72 }] },
  { label: 'Backend', skills: [{ name: 'Node.js', pct: 88 }, { name: 'Go', pct: 78 }, { name: 'PostgreSQL', pct: 85 }, { name: 'GraphQL', pct: 80 }] },
  { label: 'Mobile', skills: [{ name: 'React Native', pct: 84 }, { name: 'iOS (Swift)', pct: 60 }, { name: 'Expo', pct: 88 }] },
  { label: 'Tools & Design', skills: [{ name: 'Figma', pct: 90 }, { name: 'Docker / K8s', pct: 75 }, { name: 'AWS / GCP', pct: 72 }] },
]

export default function Skills() {
  return (
    <section className="section skills-section" id="skills">
      <div className="container">
        <div className="section-top">
          <p className="section-eyebrow">Expertise</p>
          <h2 className="section-heading">My skill set</h2>
          <p className="section-sub">A broad toolkit honed across 6+ years of professional work.</p>
        </div>
        <div className="skills-grid">
          {GROUPS.map(g => (
            <div key={g.label} className="skill-group">
              <p className="skill-group-label">{g.label}</p>
              {g.skills.map(s => (
                <div key={s.name} className="skill-item">
                  <div className="skill-row">
                    <span className="skill-name">{s.name}</span>
                    <span className="skill-pct">{s.pct}%</span>
                  </div>
                  <div className="skill-bar"><div className="skill-fill" style={{ width: \`\${s.pct}%\` }} /></div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}`,
      },
      {
        path: 'src/components/Contact.tsx',
        language: 'tsx',
        code: `import { useState } from 'react'

export default function Contact() {
  const [sent, setSent] = useState(false)
  return (
    <section className="section" id="contact">
      <div className="container">
        <div className="section-top">
          <p className="section-eyebrow">Contact</p>
          <h2 className="section-heading">Let's work together</h2>
          <p className="section-sub">Have a project in mind? I'd love to hear about it.</p>
        </div>
        <div className="contact-grid">
          {sent ? (
            <div style={{ display:'flex',alignItems:'center',justifyContent:'center',padding:'3rem',background:'var(--surface)',borderRadius:'var(--r-lg)',border:'1px solid var(--border)',textAlign:'center' }}>
              <div>
                <div style={{ fontSize:'2.5rem',marginBottom:'1rem' }}>✉️</div>
                <h3 style={{ marginBottom:'.5rem' }}>Message sent!</h3>
                <p style={{ color:'var(--muted)',fontSize:'.9rem' }}>I'll get back to you within 24 hours.</p>
              </div>
            </div>
          ) : (
            <form onSubmit={e => { e.preventDefault(); setSent(true) }}>
              <div className="form-field">
                <label className="form-label" htmlFor="cf-name">Name</label>
                <input id="cf-name" className="form-input" type="text" placeholder="Your name" required />
              </div>
              <div className="form-field">
                <label className="form-label" htmlFor="cf-email">Email</label>
                <input id="cf-email" className="form-input" type="email" placeholder="you@company.com" required />
              </div>
              <div className="form-field">
                <label className="form-label" htmlFor="cf-msg">Message</label>
                <textarea id="cf-msg" className="form-textarea" placeholder="Tell me about your project…" required />
              </div>
              <button type="submit" className="btn-primary">Send message →</button>
            </form>
          )}
          <div className="contact-side">
            <h3 className="contact-side-title">Get in touch</h3>
            <p className="contact-side-text">I'm open to new opportunities — full-time, freelance, or just a chat about tech. My inbox is always open.</p>
            <div className="socials">
              <a href="#" className="social-item"><span className="social-icon">🐙</span>github.com/alexchen</a>
              <a href="#" className="social-item"><span className="social-icon">💼</span>linkedin.com/in/alexchen</a>
              <a href="#" className="social-item"><span className="social-icon">🐦</span>@alexchen_dev</a>
              <a href="#" className="social-item"><span className="social-icon">📬</span>hello@alexchen.dev</a>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}`,
      },
    ],
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Template 2: SaaS Landing Page
// ─────────────────────────────────────────────────────────────────────────────
function saasLanding(): Template {
  return {
    id: 'saas-landing',
    name: 'SaaS Landing Page',
    description: 'A polished SaaS landing page with strong conversion sections and product storytelling.',
    category: 'SaaS',
    accentColor: '#2563eb',
    highlights: [
      'Clear hero, proof metrics, and animated dashboard mockup',
      'Feature grid, testimonial cards, and pricing tiers',
      'FAQ accordion with smooth expand/collapse behavior',
      'Conversion-focused CTA section and footer',
    ],
    files: [
      {
        path: 'src/styles/theme.css',
        language: 'css',
        code: `*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
html{scroll-behavior:smooth}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',system-ui,sans-serif;background:#fff;color:#0f172a;line-height:1.6;overflow-x:hidden}
a{color:inherit;text-decoration:none}
button{cursor:pointer;border:none;background:none;font:inherit;color:inherit}

:root{
  --bg:#fff;--bg-2:#f8fafc;--bg-3:#f1f5f9;
  --border:#e2e8f0;--text:#0f172a;--muted:#64748b;
  --accent:#2563eb;--accent-light:rgba(37,99,235,.08);--accent-glow:rgba(37,99,235,.25);
  --green:#10b981;--r:10px;--r-lg:16px;--r-xl:24px;
}

.navbar{position:sticky;top:0;z-index:100;background:rgba(255,255,255,.9);backdrop-filter:blur(20px);border-bottom:1px solid var(--border)}
.navbar-inner{max-width:1200px;margin:0 auto;padding:0 1.5rem;height:60px;display:flex;align-items:center;justify-content:space-between}
.nav-logo{font-weight:800;font-size:1.15rem;letter-spacing:-.02em;display:flex;align-items:center;gap:.5rem}
.nav-logo-icon{width:28px;height:28px;background:var(--accent);border-radius:7px;display:grid;place-items:center;color:#fff;font-size:.85rem;font-weight:900}
.nav-links{display:flex;align-items:center;gap:.25rem}
.nav-link{padding:.4rem .875rem;font-size:.875rem;color:var(--muted);border-radius:var(--r);transition:all .15s}
.nav-link:hover{color:var(--text);background:var(--bg-3)}
.nav-actions{display:flex;align-items:center;gap:.75rem}
.btn-login{padding:.45rem 1rem;font-size:.875rem;color:var(--muted);transition:color .15s}
.btn-login:hover{color:var(--text)}
.btn-signup{padding:.5rem 1.125rem;background:var(--accent);color:#fff;border-radius:var(--r);font-size:.875rem;font-weight:600;transition:all .2s}
.btn-signup:hover{background:#1d4ed8;transform:translateY(-1px);box-shadow:0 4px 12px var(--accent-glow)}

.hero{padding:6rem 1.5rem 4rem;text-align:center;max-width:900px;margin:0 auto}
.hero-badge{display:inline-flex;align-items:center;gap:.5rem;padding:.3rem .875rem;border-radius:999px;background:var(--accent-light);border:1px solid rgba(37,99,235,.2);font-size:.75rem;font-weight:600;color:var(--accent);letter-spacing:.04em;margin-bottom:1.75rem}
.hero-badge-new{background:var(--accent);color:#fff;padding:.15rem .5rem;border-radius:4px;font-size:.65rem;font-weight:800;letter-spacing:.06em}
.hero-heading{font-size:clamp(2.5rem,6vw,4.5rem);font-weight:800;letter-spacing:-.04em;line-height:1.05;margin-bottom:1.25rem}
.hero-heading em{color:var(--accent);font-style:normal}
.hero-sub{font-size:clamp(1rem,1.5vw,1.2rem);color:var(--muted);max-width:560px;margin:0 auto 2.5rem;line-height:1.7}
.hero-ctas{display:flex;gap:1rem;justify-content:center;flex-wrap:wrap;margin-bottom:3rem}
.cta-primary{padding:.875rem 2rem;background:var(--accent);color:#fff;border-radius:var(--r-lg);font-weight:700;font-size:1rem;transition:all .2s;display:inline-flex;align-items:center;gap:.5rem}
.cta-primary:hover{background:#1d4ed8;transform:translateY(-2px);box-shadow:0 8px 24px var(--accent-glow)}
.cta-secondary{padding:.875rem 2rem;color:var(--text);border:1.5px solid var(--border);border-radius:var(--r-lg);font-weight:600;font-size:1rem;transition:all .2s}
.cta-secondary:hover{border-color:var(--accent);color:var(--accent)}
.hero-stats{display:flex;align-items:center;justify-content:center;gap:3rem;padding-top:1.5rem;border-top:1px solid var(--border)}
.stat-number{font-size:1.5rem;font-weight:800;letter-spacing:-.03em}
.stat-label{font-size:.75rem;color:var(--muted);margin-top:.15rem}

.mockup-wrapper{max-width:900px;margin:0 auto 5rem;padding:0 1.5rem}
.mockup-frame{background:var(--bg-2);border:1px solid var(--border);border-radius:var(--r-xl);overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,.08)}
.mockup-topbar{padding:.75rem 1rem;background:var(--bg-3);border-bottom:1px solid var(--border);display:flex;align-items:center;gap:.5rem}
.mockup-dot{width:10px;height:10px;border-radius:50%}
.mockup-dot-r{background:#ff5f57}.mockup-dot-y{background:#ffbd2e}.mockup-dot-g{background:#28ca41}
.mockup-urlbar{flex:1;margin:0 1rem;padding:.25rem .75rem;background:var(--bg);border:1px solid var(--border);border-radius:6px;font-size:.75rem;color:var(--muted);text-align:center}
.mockup-body{display:flex;height:280px}
.mockup-sidebar{width:160px;padding:1rem;border-right:1px solid var(--border);display:flex;flex-direction:column;gap:.5rem}
.mockup-sb-item{height:26px;background:var(--bg-3);border-radius:6px}
.mockup-sb-active{background:var(--accent-light);border:1px solid rgba(37,99,235,.2)}
.mockup-main{flex:1;padding:1.25rem;display:flex;flex-direction:column;gap:.75rem}
.mockup-chart{flex:1;background:var(--accent-light);border-radius:var(--r);border:1px solid rgba(37,99,235,.12);display:flex;align-items:flex-end;padding:0 1rem .5rem;gap:.35rem;overflow:hidden}
.mockup-bar{border-radius:4px 4px 0 0;background:var(--accent);flex:1}
.mockup-row{display:flex;gap:.75rem}
.mockup-card{flex:1;height:48px;background:var(--bg-3);border-radius:var(--r);border:1px solid var(--border)}

.features-section{padding:5rem 1.5rem;background:var(--bg-2)}
.section-top{text-align:center;margin-bottom:3.5rem}
.section-label{font-size:.7rem;font-weight:700;letter-spacing:.15em;text-transform:uppercase;color:var(--accent);margin-bottom:.75rem}
.section-heading{font-size:clamp(1.75rem,3vw,2.5rem);font-weight:800;letter-spacing:-.03em;margin-bottom:.75rem}
.section-sub{font-size:1rem;color:var(--muted);max-width:480px;margin:0 auto}
.features-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:1.5rem;max-width:1100px;margin:0 auto}
.feature-card{background:var(--bg);border:1px solid var(--border);border-radius:var(--r-lg);padding:1.75rem;transition:all .2s}
.feature-card:hover{box-shadow:0 8px 24px rgba(0,0,0,.06);transform:translateY(-2px)}
.feature-icon{width:44px;height:44px;background:var(--accent-light);border-radius:var(--r);display:grid;place-items:center;font-size:1.2rem;margin-bottom:1rem}
.feature-title{font-size:1rem;font-weight:700;margin-bottom:.5rem}
.feature-desc{font-size:.875rem;color:var(--muted);line-height:1.65}

.testimonials-section{padding:5rem 1.5rem}
.testimonials-inner{max-width:1100px;margin:0 auto}
.testimonials-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:1.5rem;margin-top:3rem}
.t-card{background:var(--bg-2);border:1px solid var(--border);border-radius:var(--r-lg);padding:1.75rem}
.t-stars{color:#f59e0b;font-size:.9rem;letter-spacing:.05em;margin-bottom:1rem}
.t-text{font-size:.9rem;line-height:1.7;margin-bottom:1.25rem}
.t-author{display:flex;align-items:center;gap:.75rem}
.t-avatar{width:36px;height:36px;border-radius:50%;overflow:hidden;flex-shrink:0;background:var(--bg-3)}
.t-avatar img{width:100%;height:100%;object-fit:cover;display:block}
.t-name{font-size:.875rem;font-weight:600}
.t-role{font-size:.75rem;color:var(--muted)}

.pricing-section{padding:5rem 1.5rem;background:var(--bg-2)}
.pricing-inner{max-width:1000px;margin:0 auto}
.pricing-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:1.5rem;margin-top:3rem}
.pricing-card{background:var(--bg);border:1.5px solid var(--border);border-radius:var(--r-xl);padding:2rem;position:relative}
.pricing-card.featured{border-color:var(--accent);box-shadow:0 0 0 4px var(--accent-light)}
.featured-badge{position:absolute;top:-12px;left:50%;transform:translateX(-50%);background:var(--accent);color:#fff;font-size:.7rem;font-weight:800;letter-spacing:.06em;padding:.25rem .875rem;border-radius:999px;white-space:nowrap}
.pricing-tier{font-size:.75rem;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--muted);margin-bottom:.5rem}
.pricing-price{font-size:2.5rem;font-weight:800;letter-spacing:-.04em;margin-bottom:.25rem}
.pricing-price sup{font-size:1.25rem;vertical-align:top;margin-top:.6rem;display:inline-block}
.pricing-period{font-size:.8rem;color:var(--muted);margin-bottom:1.25rem}
.pricing-divider{height:1px;background:var(--border);margin:1.25rem 0}
.pricing-features{list-style:none;display:flex;flex-direction:column;gap:.6rem;margin-bottom:1.75rem}
.pricing-feature{font-size:.875rem;color:var(--muted);display:flex;align-items:center;gap:.5rem}
.pricing-feature::before{content:'✓';color:var(--green);font-weight:700;flex-shrink:0}
.pricing-cta{display:block;padding:.75rem;text-align:center;border-radius:var(--r);font-weight:600;font-size:.875rem;transition:all .2s;border:1.5px solid var(--border);color:var(--text)}
.pricing-cta:hover{border-color:var(--accent);color:var(--accent)}
.pricing-card.featured .pricing-cta{background:var(--accent);color:#fff;border-color:var(--accent)}
.pricing-card.featured .pricing-cta:hover{background:#1d4ed8}

.faq-section{padding:5rem 1.5rem}
.faq-inner{max-width:700px;margin:0 auto}
.faq-list{margin-top:2.5rem}
.faq-item{border-bottom:1px solid var(--border)}
.faq-q{width:100%;padding:1.25rem 0;display:flex;justify-content:space-between;align-items:center;font-size:.95rem;font-weight:600;text-align:left;gap:1rem;transition:color .2s}
.faq-q:hover{color:var(--accent)}
.faq-chevron{flex-shrink:0;font-size:.75rem;color:var(--muted);transition:transform .2s;display:inline-block}
.faq-chevron.open{transform:rotate(180deg)}
.faq-a{font-size:.875rem;color:var(--muted);line-height:1.75;padding-bottom:1.25rem}

.cta-section{padding:4rem 1.5rem}
.cta-box{max-width:780px;margin:0 auto;background:linear-gradient(135deg,#1e40af,#2563eb);border-radius:var(--r-xl);padding:4rem 3rem;text-align:center;box-shadow:0 20px 60px rgba(37,99,235,.3)}
.cta-box h2{font-size:clamp(1.75rem,3vw,2.5rem);font-weight:800;color:#fff;letter-spacing:-.03em;margin-bottom:.75rem}
.cta-box p{color:rgba(255,255,255,.75);font-size:1rem;margin-bottom:2rem}
.cta-box .cta-primary{background:#fff;color:var(--accent)}
.cta-box .cta-primary:hover{background:#f0f4ff}

@media(max-width:900px){.features-grid,.testimonials-grid,.pricing-grid{grid-template-columns:1fr}}
@media(max-width:768px){.nav-links{display:none}.mockup-sidebar{display:none}}`,
      },
      {
        path: 'src/App.tsx',
        language: 'tsx',
        code: `import Navbar from './components/Navbar'
import Hero from './components/Hero'
import Features from './components/Features'
import Testimonials from './components/Testimonials'
import Pricing from './components/Pricing'
import FAQ from './components/FAQ'
import './styles/theme.css'

export default function App() {
  return (
    <div>
      <Navbar />
      <Hero />
      <Features />
      <Testimonials />
      <Pricing />
      <FAQ />
      <section className="cta-section">
        <div className="cta-box">
          <h2>Start building today</h2>
          <p>Join thousands of teams already using Synapse. Free for 14 days.</p>
          <a href="#" className="cta-primary">Get started free →</a>
        </div>
      </section>
      <footer style={{ padding: '2rem 1.5rem', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', maxWidth: '1200px', margin: '0 auto' }}>
        <span style={{ fontWeight: 800 }}>⬡ Synapse</span>
        <div style={{ display: 'flex', gap: '1.5rem' }}>
          {['Privacy', 'Terms', 'Blog', 'Status'].map(l => <a key={l} href="#" style={{ fontSize: '.8rem', color: 'var(--muted)' }}>{l}</a>)}
        </div>
        <span style={{ fontSize: '.8rem', color: 'var(--muted)' }}>© 2025 Synapse Inc.</span>
      </footer>
    </div>
  )
}`,
      },
      {
        path: 'src/components/Navbar.tsx',
        language: 'tsx',
        code: `export default function Navbar() {
  return (
    <header className="navbar">
      <div className="navbar-inner">
        <a href="#" className="nav-logo">
          <span className="nav-logo-icon">S</span>
          Synapse
        </a>
        <nav className="nav-links">
          <a href="#features" className="nav-link">Features</a>
          <a href="#testimonials" className="nav-link">Customers</a>
          <a href="#pricing" className="nav-link">Pricing</a>
          <a href="#faq" className="nav-link">FAQ</a>
        </nav>
        <div className="nav-actions">
          <a href="#" className="btn-login">Log in</a>
          <a href="#" className="btn-signup">Get started free</a>
        </div>
      </div>
    </header>
  )
}`,
      },
      {
        path: 'src/components/Hero.tsx',
        language: 'tsx',
        code: `const BAR_HEIGHTS = [40, 65, 50, 80, 60, 90, 70, 55, 75, 85, 45, 95]

export default function Hero() {
  return (
    <>
      <section className="hero">
        <div className="hero-badge">
          <span className="hero-badge-new">NEW</span>
          Synapse AI 2.0 — now with predictive analytics
        </div>
        <h1 className="hero-heading">
          Analytics that <em>actually</em> drive growth
        </h1>
        <p className="hero-sub">
          Synapse turns raw data into actionable insights in minutes. No SQL required.
        </p>
        <div className="hero-ctas">
          <a href="#" className="cta-primary">Start for free →</a>
          <a href="#" className="cta-secondary">Watch demo</a>
        </div>
        <div className="hero-stats">
          <div><p className="stat-number">12k+</p><p className="stat-label">Teams using Synapse</p></div>
          <div><p className="stat-number">99.9%</p><p className="stat-label">Uptime SLA</p></div>
          <div><p className="stat-number">4.9★</p><p className="stat-label">Average rating</p></div>
        </div>
      </section>
      <div className="mockup-wrapper">
        <div className="mockup-frame">
          <div className="mockup-topbar">
            <span className="mockup-dot mockup-dot-r" />
            <span className="mockup-dot mockup-dot-y" />
            <span className="mockup-dot mockup-dot-g" />
            <span className="mockup-urlbar">app.synapse.io/dashboard</span>
          </div>
          <div className="mockup-body">
            <div className="mockup-sidebar">
              {['Dashboard', 'Analytics', 'Reports', 'Audiences', 'Settings'].map((item, i) => (
                <div key={item} className={\`mockup-sb-item\${i === 0 ? ' mockup-sb-active' : ''}\`} />
              ))}
            </div>
            <div className="mockup-main">
              <div className="mockup-chart">
                {BAR_HEIGHTS.map((h, i) => (
                  <div key={i} className="mockup-bar" style={{ height: \`\${h}%\`, opacity: 0.5 + (i / BAR_HEIGHTS.length) * 0.5 }} />
                ))}
              </div>
              <div className="mockup-row">
                <div className="mockup-card" /><div className="mockup-card" /><div className="mockup-card" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}`,
      },
      {
        path: 'src/components/Features.tsx',
        language: 'tsx',
        code: `const FEATURES = [
  { icon: '⚡', title: 'Real-time dashboards', desc: 'Watch metrics update live. No waiting for overnight batch jobs.' },
  { icon: '🤖', title: 'AI-powered insights', desc: 'Our AI surfaces anomalies and opportunities before you look for them.' },
  { icon: '🔌', title: '200+ integrations', desc: 'Connect Stripe, Salesforce, Postgres, and 200+ more in 60 seconds.' },
  { icon: '📊', title: 'Custom reports', desc: 'Build pixel-perfect reports and share with a single link.' },
  { icon: '🔒', title: 'Enterprise security', desc: 'SOC 2 Type II, GDPR compliant, SSO, and row-level permissions.' },
  { icon: '🚀', title: 'Blazing fast queries', desc: 'Columnar storage means even billion-row queries return in seconds.' },
]

export default function Features() {
  return (
    <section className="features-section" id="features">
      <div className="section-top">
        <p className="section-label">Features</p>
        <h2 className="section-heading">Everything you need to understand your business</h2>
        <p className="section-sub">Purpose-built for growth teams who need answers fast.</p>
      </div>
      <div className="features-grid">
        {FEATURES.map(f => (
          <div key={f.title} className="feature-card">
            <div className="feature-icon">{f.icon}</div>
            <h3 className="feature-title">{f.title}</h3>
            <p className="feature-desc">{f.desc}</p>
          </div>
        ))}
      </div>
    </section>
  )
}`,
      },
      {
        path: 'src/components/Testimonials.tsx',
        language: 'tsx',
        code: `const TESTIMONIALS = [
  { text: 'Synapse replaced 3 different tools. Our team spends 80% less time on reporting and AI insights drove a 23% revenue increase.', name: 'Sarah Chen', role: 'VP of Growth, Meridian', avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=120&q=80&auto=format&fit=crop' },
  { text: 'I cancelled our Mixpanel subscription within a week. The UX is just on a different level.', name: 'Marcus Williams', role: 'Head of Product, Stackwell', avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=120&q=80&auto=format&fit=crop' },
  { text: 'The real-time alerts saved us from a major churn event. We caught a drop 48 hours before it became a real problem.', name: 'Priya Patel', role: 'CEO, Loopback AI', avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=120&q=80&auto=format&fit=crop' },
]

export default function Testimonials() {
  return (
    <section className="testimonials-section" id="testimonials">
      <div className="testimonials-inner">
        <div className="section-top">
          <p className="section-label">Testimonials</p>
          <h2 className="section-heading">Trusted by 12,000+ teams</h2>
          <p className="section-sub">Don't take our word for it.</p>
        </div>
        <div className="testimonials-grid">
          {TESTIMONIALS.map(t => (
            <div key={t.name} className="t-card">
              <div className="t-stars">★★★★★</div>
              <p className="t-text">"{t.text}"</p>
              <div className="t-author">
                <div className="t-avatar"><img src={t.avatar} alt={t.name} /></div>
                <div><p className="t-name">{t.name}</p><p className="t-role">{t.role}</p></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}`,
      },
      {
        path: 'src/components/Pricing.tsx',
        language: 'tsx',
        code: `const PLANS = [
  { name: 'Starter', price: 29, features: ['Up to 5 users', '10 data sources', '30-day history', 'Email support', 'Core dashboards'], featured: false },
  { name: 'Pro', price: 99, features: ['Up to 25 users', 'Unlimited sources', '1-year history', 'Priority support', 'AI insights', 'Custom reports', 'API access'], featured: true },
  { name: 'Enterprise', price: 299, features: ['Unlimited users', 'Unlimited sources', 'Unlimited history', 'Dedicated CSM', 'SSO & SAML', 'Custom SLA', 'On-premise'], featured: false },
]

export default function Pricing() {
  return (
    <section className="pricing-section" id="pricing">
      <div className="pricing-inner">
        <div className="section-top">
          <p className="section-label">Pricing</p>
          <h2 className="section-heading">Simple, transparent pricing</h2>
          <p className="section-sub">No hidden fees. Cancel any time.</p>
        </div>
        <div className="pricing-grid">
          {PLANS.map(plan => (
            <div key={plan.name} className={\`pricing-card\${plan.featured ? ' featured' : ''}\`}>
              {plan.featured && <span className="featured-badge">MOST POPULAR</span>}
              <p className="pricing-tier">{plan.name}</p>
              <p className="pricing-price"><sup>$</sup>{plan.price}</p>
              <p className="pricing-period">per month · billed annually</p>
              <div className="pricing-divider" />
              <ul className="pricing-features">
                {plan.features.map(f => <li key={f} className="pricing-feature">{f}</li>)}
              </ul>
              <a href="#" className="pricing-cta">Get started</a>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}`,
      },
      {
        path: 'src/components/FAQ.tsx',
        language: 'tsx',
        code: `import { useState } from 'react'

const FAQS = [
  { q: 'How long does it take to set up?', a: 'Most teams are up in under 15 minutes. Connect your first data source and Synapse auto-builds your first dashboard.' },
  { q: 'Do I need SQL knowledge?', a: 'No. Synapse is designed for business users. Natural language queries let you ask questions in plain English.' },
  { q: 'Can I try before buying?', a: 'Yes — every plan starts with a 14-day free trial, no credit card required.' },
  { q: 'Is my data secure?', a: "Synapse is SOC 2 Type II certified and GDPR compliant. Data is encrypted in transit and at rest. We never sell your data." },
  { q: 'What if I exceed my plan limits?', a: "We'll notify you before you hit limits. Upgrade instantly or we can discuss a custom plan." },
]

export default function FAQ() {
  const [open, setOpen] = useState<number | null>(null)
  return (
    <section className="faq-section" id="faq">
      <div className="faq-inner">
        <div className="section-top">
          <p className="section-label">FAQ</p>
          <h2 className="section-heading">Frequently asked questions</h2>
        </div>
        <div className="faq-list">
          {FAQS.map((faq, i) => (
            <div key={i} className="faq-item">
              <button className="faq-q" onClick={() => setOpen(open === i ? null : i)} type="button">
                {faq.q}
                <span className={\`faq-chevron\${open === i ? ' open' : ''}\`}>▼</span>
              </button>
              {open === i && <p className="faq-a">{faq.a}</p>}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}`,
      },
    ],
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Template 3: E-commerce Storefront
// ─────────────────────────────────────────────────────────────────────────────
function ecommerceStorefront(): Template {
  return {
    id: 'ecommerce-storefront',
    name: 'E-commerce Storefront',
    description: 'A premium product storefront with cart drawer and editorial aesthetic.',
    category: 'E-commerce',
    accentColor: '#1a5c3a',
    highlights: [
      'Editorial commerce hero with real product photography',
      'Responsive product grid with hover quick-add',
      'Slide-in cart drawer with quantity controls',
      'Refined category navigation and sticky header',
    ],
    files: [
      {
        path: 'src/styles/theme.css',
        language: 'css',
        code: `*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
html{scroll-behavior:smooth}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',system-ui,sans-serif;background:#faf8f4;color:#1a1a1a;line-height:1.6;overflow-x:hidden}
a{color:inherit;text-decoration:none}
button{cursor:pointer;border:none;background:none;font:inherit;color:inherit}

:root{
  --bg:#faf8f4;--bg-2:#f2efe9;
  --border:#e8e3da;--text:#1a1a1a;--muted:#7a7060;
  --accent:#1a5c3a;--accent-light:rgba(26,92,58,.08);--accent-glow:rgba(26,92,58,.2);
  --r:8px;--r-lg:14px;--r-xl:20px;
}

.navbar{position:sticky;top:0;z-index:100;background:rgba(250,248,244,.95);backdrop-filter:blur(12px);border-bottom:1px solid var(--border)}
.navbar-inner{max-width:1300px;margin:0 auto;padding:0 2rem;height:64px;display:flex;align-items:center;justify-content:space-between}
.nav-logo{font-size:1.2rem;font-weight:900;letter-spacing:-.03em}
.nav-links{display:flex}
.nav-link{padding:.5rem 1rem;font-size:.875rem;color:var(--muted);transition:color .15s}
.nav-link:hover{color:var(--text)}
.nav-actions{display:flex;align-items:center;gap:.5rem}
.nav-icon-btn{min-width:52px;height:40px;padding:0 .6rem;display:grid;place-items:center;border-radius:var(--r);transition:background .15s;font-size:.75rem;font-weight:700;letter-spacing:.04em;text-transform:uppercase;position:relative}
.nav-icon-btn:hover{background:var(--bg-2)}
.cart-badge{position:absolute;top:4px;right:4px;width:16px;height:16px;background:var(--accent);color:#fff;border-radius:50%;font-size:.6rem;font-weight:700;display:grid;place-items:center}

.hero{display:grid;grid-template-columns:1fr 1fr;max-width:1300px;margin:0 auto;padding:4rem 2rem;gap:4rem;align-items:center}
.hero-overline{font-size:.7rem;font-weight:700;letter-spacing:.15em;text-transform:uppercase;color:var(--accent);margin-bottom:1.5rem}
.hero-heading{font-size:clamp(2.5rem,4vw,4rem);font-weight:900;letter-spacing:-.04em;line-height:1.0;margin-bottom:1.25rem}
.hero-desc{font-size:1rem;color:var(--muted);max-width:420px;line-height:1.75;margin-bottom:2rem}
.hero-price{font-size:1.5rem;font-weight:700;margin-bottom:1.75rem}
.hero-price span{font-size:1rem;color:var(--muted);font-weight:400;margin-left:.5rem;text-decoration:line-through}
.hero-actions{display:flex;gap:1rem}
.btn-add{padding:.875rem 2rem;background:var(--accent);color:#fff;border-radius:var(--r-lg);font-weight:700;font-size:.95rem;transition:all .2s}
.btn-add:hover{background:#134d2f;transform:translateY(-1px);box-shadow:0 6px 20px var(--accent-glow)}
.btn-wishlist{padding:.875rem 1.5rem;border:1.5px solid var(--border);border-radius:var(--r-lg);color:var(--text);font-weight:500;font-size:.95rem;transition:all .2s}
.btn-wishlist:hover{border-color:var(--accent);color:var(--accent)}
.hero-image-side{position:relative}
.hero-product-img{width:100%;aspect-ratio:3/4;max-height:420px;border-radius:var(--r-xl);overflow:hidden;background:var(--bg-2);position:relative}
.hero-badge-float{position:absolute;bottom:2rem;left:-1.5rem;background:#fff;border-radius:var(--r-lg);padding:.875rem 1.25rem;box-shadow:0 8px 24px rgba(0,0,0,.12);display:flex;align-items:center;gap:.75rem}
.hero-badge-icon{width:36px;height:36px;border-radius:50%;background:var(--accent-light);color:var(--accent);display:grid;place-items:center;font-size:.75rem;font-weight:900;letter-spacing:.08em}
.hero-badge-text strong{display:block;font-size:.85rem;font-weight:700}
.hero-badge-text span{font-size:.75rem;color:var(--muted)}

.categories-section{padding:2.5rem 2rem;border-bottom:1px solid var(--border)}
.categories-inner{max-width:1300px;margin:0 auto}
.categories-label{font-size:.7rem;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:var(--muted);margin-bottom:1rem}
.categories-list{display:flex;gap:.75rem;flex-wrap:wrap}
.cat-pill{padding:.5rem 1.25rem;border-radius:999px;font-size:.875rem;border:1.5px solid var(--border);color:var(--muted);transition:all .2s;font-weight:500}
.cat-pill:hover{border-color:var(--accent);color:var(--accent)}
.cat-pill.active{background:var(--accent);border-color:var(--accent);color:#fff}

.products-section{padding:4rem 2rem;max-width:1300px;margin:0 auto}
.products-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:2rem}
.products-title{font-size:1.5rem;font-weight:800;letter-spacing:-.02em}
.products-count{font-size:.875rem;color:var(--muted)}
.products-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:1.5rem}
.product-card{background:var(--bg);border:1px solid var(--border);border-radius:var(--r-xl);overflow:hidden;transition:all .25s;cursor:pointer}
.product-card:hover{transform:translateY(-4px);box-shadow:0 12px 40px rgba(0,0,0,.1)}
.product-img{aspect-ratio:1;background:var(--bg-2);display:flex;align-items:center;justify-content:center;position:relative;overflow:hidden}
.product-quick-add{position:absolute;bottom:0;left:0;right:0;padding:.875rem;background:var(--accent);color:#fff;font-weight:700;font-size:.875rem;text-align:center;transform:translateY(100%);transition:transform .25s}
.product-card:hover .product-quick-add{transform:translateY(0)}
.product-body{padding:1rem 1.25rem 1.25rem}
.product-category{font-size:.7rem;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--accent);margin-bottom:.3rem}
.product-name{font-size:.95rem;font-weight:600;margin-bottom:.5rem}
.product-footer{display:flex;align-items:center;justify-content:space-between}
.product-price{font-size:1.1rem;font-weight:800;letter-spacing:-.02em}
.product-rating{font-size:.8rem;color:var(--muted)}

.cart-backdrop{position:fixed;inset:0;background:rgba(0,0,0,.4);z-index:200;animation:fadeIn .2s}
@keyframes fadeIn{from{opacity:0}to{opacity:1}}
.cart-drawer{position:fixed;top:0;right:0;bottom:0;width:420px;max-width:100vw;background:#fff;z-index:201;display:flex;flex-direction:column;animation:slideIn .3s ease-out;box-shadow:-20px 0 60px rgba(0,0,0,.15)}
@keyframes slideIn{from{transform:translateX(100%)}to{transform:translateX(0)}}
.cart-header{padding:1.5rem;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between}
.cart-title{font-size:1.1rem;font-weight:700}
.cart-close{width:36px;height:36px;display:grid;place-items:center;border-radius:var(--r);transition:background .15s;font-size:1.1rem}
.cart-close:hover{background:var(--bg-2)}
.cart-items{flex:1;overflow-y:auto;padding:1.25rem}
.cart-item{display:flex;gap:1rem;padding:1rem 0;border-bottom:1px solid var(--border)}
.cart-item:last-child{border-bottom:none}
.cart-item-img{width:72px;height:72px;background:var(--bg-2);border-radius:var(--r);display:grid;place-items:center;flex-shrink:0;overflow:hidden}
.cart-item-info{flex:1}
.cart-item-name{font-size:.875rem;font-weight:600;margin-bottom:.25rem}
.cart-item-cat{font-size:.75rem;color:var(--muted);margin-bottom:.5rem}
.cart-item-row{display:flex;align-items:center;justify-content:space-between}
.cart-item-price{font-size:.95rem;font-weight:700}
.cart-qty{display:flex;align-items:center;gap:.5rem}
.cart-qty-btn{width:24px;height:24px;border-radius:4px;background:var(--bg-2);display:grid;place-items:center;font-size:.9rem;transition:background .15s}
.cart-qty-btn:hover{background:var(--border)}
.cart-qty-num{font-size:.875rem;font-weight:600;min-width:16px;text-align:center}
.cart-footer{padding:1.25rem 1.5rem;border-top:1px solid var(--border)}
.cart-subtotal{display:flex;justify-content:space-between;margin-bottom:.5rem;font-size:.9rem}
.cart-subtotal-label{color:var(--muted)}
.cart-subtotal-value{font-weight:700}
.cart-total{display:flex;justify-content:space-between;margin-bottom:1.5rem;font-size:1.1rem;font-weight:800}
.cart-checkout{display:block;width:100%;padding:1rem;background:var(--accent);color:#fff;border-radius:var(--r-lg);font-weight:700;font-size:1rem;text-align:center;transition:all .2s}
.cart-checkout:hover{background:#134d2f}
.cart-empty{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:3rem;text-align:center;color:var(--muted)}
.cart-empty-icon{font-size:.8rem;font-weight:800;letter-spacing:.12em;text-transform:uppercase;margin-bottom:1rem}

.site-footer{background:#1a1a1a;color:#e8e3da;padding:3rem 2rem 2rem;margin-top:4rem}
.footer-inner{max-width:1300px;margin:0 auto;display:grid;grid-template-columns:2fr 1fr 1fr 1fr;gap:3rem;margin-bottom:2rem}
.footer-brand{font-size:1.2rem;font-weight:900;letter-spacing:-.02em;margin-bottom:.75rem}
.footer-tagline{font-size:.85rem;color:#9ca3af;line-height:1.6}
.footer-heading{font-size:.7rem;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#6b7280;margin-bottom:.875rem}
.footer-links-list{display:flex;flex-direction:column;gap:.5rem}
.footer-link{font-size:.85rem;color:#9ca3af;transition:color .15s}
.footer-link:hover{color:#e8e3da}
.footer-bottom{border-top:1px solid #2d2d2d;padding-top:1.5rem;max-width:1300px;margin:0 auto;display:flex;justify-content:space-between;align-items:center;font-size:.8rem;color:#6b7280}

.hero-product-img img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.product-img img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.cart-item-img img{width:100%;height:100%;object-fit:cover;border-radius:var(--r)}
@media(max-width:900px){.hero{grid-template-columns:1fr;padding:3rem 1.5rem}.hero-image-side{order:-1}.footer-inner{grid-template-columns:1fr 1fr}}
@media(max-width:768px){.nav-links{display:none}.products-grid{grid-template-columns:repeat(2,1fr)}.footer-inner{grid-template-columns:1fr}}`,
      },
      {
        path: 'src/App.tsx',
        language: 'tsx',
        code: `import { useState } from 'react'
import Navbar from './components/Navbar'
import Hero from './components/Hero'
import Categories from './components/Categories'
import ProductGrid from './components/ProductGrid'
import CartDrawer from './components/CartDrawer'
import './styles/theme.css'

export interface CartItem {
  id: number
  name: string
  price: number
  img: string
  category: string
  qty: number
}

export default function App() {
  const [cartOpen, setCartOpen] = useState(false)
  const [cartItems, setCartItems] = useState<CartItem[]>([])

  const addToCart = (item: Omit<CartItem, 'qty'>) => {
    setCartItems(prev => {
      const existing = prev.find(i => i.id === item.id)
      if (existing) return prev.map(i => i.id === item.id ? { ...i, qty: i.qty + 1 } : i)
      return [...prev, { ...item, qty: 1 }]
    })
    setCartOpen(true)
  }

  const updateQty = (id: number, delta: number) => {
    setCartItems(prev =>
      prev.map(i => i.id === id ? { ...i, qty: Math.max(0, i.qty + delta) } : i).filter(i => i.qty > 0)
    )
  }

  const cartCount = cartItems.reduce((s, i) => s + i.qty, 0)

  return (
    <div>
      <Navbar cartCount={cartCount} onCartOpen={() => setCartOpen(true)} />
      <Hero onAddToCart={addToCart} />
      <Categories />
      <ProductGrid onAddToCart={addToCart} />
      <footer className="site-footer">
        <div className="footer-inner">
          <div>
            <p className="footer-brand">VERDE<span style={{ color: '#4ade80' }}>.</span></p>
            <p className="footer-tagline">Curated goods for conscious living. Sustainably sourced, thoughtfully designed.</p>
          </div>
          {([['Shop', ['New arrivals', 'Best sellers', 'Sale', 'Gift cards']], ['Company', ['About', 'Sustainability', 'Press', 'Careers']], ['Help', ['FAQ', 'Shipping', 'Returns', 'Contact']]] as [string, string[]][]).map(([heading, links]) => (
            <div key={heading}>
              <p className="footer-heading">{heading}</p>
              <div className="footer-links-list">
                {links.map(l => <a key={l} href="#" className="footer-link">{l}</a>)}
              </div>
            </div>
          ))}
        </div>
        <div className="footer-bottom">
          <span>© 2025 Verde. All rights reserved.</span>
          <span>Certified organic materials</span>
        </div>
      </footer>
      {cartOpen && <CartDrawer items={cartItems} onClose={() => setCartOpen(false)} onUpdateQty={updateQty} />}
    </div>
  )
}`,
      },
      {
        path: 'src/components/Navbar.tsx',
        language: 'tsx',
        code: `interface NavbarProps { cartCount: number; onCartOpen: () => void }

export default function Navbar({ cartCount, onCartOpen }: NavbarProps) {
  return (
    <header className="navbar">
      <div className="navbar-inner">
        <a href="#" className="nav-logo">VERDE<span style={{ color: 'var(--accent)' }}>.</span></a>
        <nav className="nav-links">
          <a href="#" className="nav-link">New arrivals</a>
          <a href="#" className="nav-link">Collections</a>
          <a href="#" className="nav-link">Sale</a>
          <a href="#" className="nav-link">About</a>
        </nav>
        <div className="nav-actions">
          <button className="nav-icon-btn" type="button" aria-label="Search">Search</button>
          <button className="nav-icon-btn" type="button" aria-label="Wishlist">Save</button>
          <button className="nav-icon-btn" type="button" aria-label="Cart" onClick={onCartOpen}>
            Bag
            {cartCount > 0 && <span className="cart-badge">{cartCount}</span>}
          </button>
        </div>
      </div>
    </header>
  )
}`,
      },
      {
        path: 'src/components/Hero.tsx',
        language: 'tsx',
        code: `import type { CartItem } from '../App'

interface HeroProps { onAddToCart: (item: Omit<CartItem, 'qty'>) => void }

export default function Hero({ onAddToCart }: HeroProps) {
  return (
    <section className="hero">
      <div>
        <p className="hero-overline">New collection — Summer 2025</p>
        <h1 className="hero-heading">The Linen Essentials Edit</h1>
        <p className="hero-desc">Premium European linen, zero compromises. Naturally breathable, endlessly versatile — from beach to city.</p>
        <p className="hero-price">€129 <span>€180</span></p>
        <div className="hero-actions">
          <button className="btn-add" type="button" onClick={() => onAddToCart({ id: 0, name: 'Linen Shirt - Sage', price: 129, img: 'https://images.unsplash.com/photo-1523381294911-8d3cead13475?w=900&q=80&auto=format&fit=crop', category: 'Apparel' })}>
            Add to cart
          </button>
          <button className="btn-wishlist" type="button">Save to wishlist</button>
        </div>
      </div>
      <div className="hero-image-side">
        <div className="hero-product-img">
          <img src="https://images.unsplash.com/photo-1523381294911-8d3cead13475?w=900&q=80&auto=format&fit=crop" alt="Linen Essentials" />
        </div>
        <div className="hero-badge-float">
          <span className="hero-badge-icon">ECO</span>
          <div className="hero-badge-text">
            <strong>100% sustainable</strong>
            <span>Certified organic linen</span>
          </div>
        </div>
      </div>
    </section>
  )
}`,
      },
      {
        path: 'src/components/Categories.tsx',
        language: 'tsx',
        code: `import { useState } from 'react'

const CATS = ['All', 'Apparel', 'Home & Living', 'Accessories', 'Skincare', 'Sale']

export default function Categories() {
  const [active, setActive] = useState('All')
  return (
    <section className="categories-section">
      <div className="categories-inner">
        <p className="categories-label">Browse by category</p>
        <div className="categories-list">
          {CATS.map(c => (
            <button key={c} className={\`cat-pill\${active === c ? ' active' : ''}\`} onClick={() => setActive(c)} type="button">{c}</button>
          ))}
        </div>
      </div>
    </section>
  )
}`,
      },
      {
        path: 'src/components/ProductGrid.tsx',
        language: 'tsx',
        code: `import type { CartItem } from '../App'

const PRODUCTS = [
  { id: 1, name: 'Linen Shirt - Sage', price: 129, img: 'https://images.unsplash.com/photo-1523381294911-8d3cead13475?w=700&q=80&auto=format&fit=crop', category: 'Apparel', rating: '4.9 (124)' },
  { id: 2, name: 'Ceramic Pour-Over Set', price: 89, img: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=700&q=80&auto=format&fit=crop', category: 'Home & Living', rating: '5.0 (68)' },
  { id: 3, name: 'Canvas Tote Bag', price: 45, img: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=700&q=80&auto=format&fit=crop', category: 'Accessories', rating: '4.8 (201)' },
  { id: 4, name: 'Rosehip Face Oil', price: 64, img: 'https://images.unsplash.com/photo-1608248543803-ba4f8c70ae0b?w=700&q=80&auto=format&fit=crop', category: 'Skincare', rating: '4.9 (89)' },
  { id: 5, name: 'Merino Knit Sweater', price: 159, img: 'https://images.unsplash.com/photo-1434389677669-e08b4cac3105?w=700&q=80&auto=format&fit=crop', category: 'Apparel', rating: '4.7 (55)' },
  { id: 6, name: 'Beeswax Candle Set', price: 38, img: 'https://images.unsplash.com/photo-1603006905003-be475563bc59?w=700&q=80&auto=format&fit=crop', category: 'Home & Living', rating: '5.0 (143)' },
  { id: 7, name: 'Leather Card Wallet', price: 55, img: 'https://images.unsplash.com/photo-1627123424574-724758594e93?w=700&q=80&auto=format&fit=crop', category: 'Accessories', rating: '4.8 (77)' },
  { id: 8, name: 'Bamboo Body Scrub', price: 29, img: 'https://images.unsplash.com/photo-1556228720-195a672e8a03?w=700&q=80&auto=format&fit=crop', category: 'Skincare', rating: '4.6 (112)' },
]

interface ProductGridProps { onAddToCart: (item: Omit<CartItem, 'qty'>) => void }

export default function ProductGrid({ onAddToCart }: ProductGridProps) {
  return (
    <section className="products-section">
      <div className="products-header">
        <h2 className="products-title">All products</h2>
        <span className="products-count">{PRODUCTS.length} items</span>
      </div>
      <div className="products-grid">
        {PRODUCTS.map(p => (
          <div key={p.id} className="product-card">
            <div className="product-img">
              <img src={p.img} alt={p.name} />
              <button className="product-quick-add" type="button" onClick={() => onAddToCart(p)}>+ Add to cart</button>
            </div>
            <div className="product-body">
              <p className="product-category">{p.category}</p>
              <h3 className="product-name">{p.name}</h3>
              <div className="product-footer">
                <span className="product-price">€{p.price}</span>
                <span className="product-rating">Rated {p.rating}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}`,
      },
      {
        path: 'src/components/CartDrawer.tsx',
        language: 'tsx',
        code: `import type { CartItem } from '../App'

interface CartDrawerProps {
  items: CartItem[]
  onClose: () => void
  onUpdateQty: (id: number, delta: number) => void
}

export default function CartDrawer({ items, onClose, onUpdateQty }: CartDrawerProps) {
  const subtotal = items.reduce((s, i) => s + i.price * i.qty, 0)
  const shipping = subtotal > 100 ? 0 : 9.90
  const total = subtotal + shipping

  return (
    <>
      <div className="cart-backdrop" onClick={onClose} />
      <aside className="cart-drawer">
        <div className="cart-header">
          <h2 className="cart-title">Your cart ({items.reduce((s, i) => s + i.qty, 0)})</h2>
          <button className="cart-close" type="button" onClick={onClose} aria-label="Close cart">✕</button>
        </div>
        {items.length === 0 ? (
          <div className="cart-empty">
            <span className="cart-empty-icon">Bag</span>
            <p>Your cart is empty</p>
          </div>
        ) : (
          <>
            <div className="cart-items">
              {items.map(item => (
                <div key={item.id} className="cart-item">
                  <div className="cart-item-img"><img src={item.img} alt={item.name} /></div>
                  <div className="cart-item-info">
                    <p className="cart-item-name">{item.name}</p>
                    <p className="cart-item-cat">{item.category}</p>
                    <div className="cart-item-row">
                      <span className="cart-item-price">€{(item.price * item.qty).toFixed(2)}</span>
                      <div className="cart-qty">
                        <button className="cart-qty-btn" type="button" onClick={() => onUpdateQty(item.id, -1)}>−</button>
                        <span className="cart-qty-num">{item.qty}</span>
                        <button className="cart-qty-btn" type="button" onClick={() => onUpdateQty(item.id, +1)}>+</button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="cart-footer">
              <div className="cart-subtotal"><span className="cart-subtotal-label">Subtotal</span><span className="cart-subtotal-value">€{subtotal.toFixed(2)}</span></div>
              <div className="cart-subtotal"><span className="cart-subtotal-label">Shipping</span><span className="cart-subtotal-value">{shipping === 0 ? 'Free' : \`€\${shipping.toFixed(2)}\`}</span></div>
              <div className="cart-total"><span>Total</span><span>€{total.toFixed(2)}</span></div>
              <a href="#" className="cart-checkout">Checkout →</a>
            </div>
          </>
        )}
      </aside>
    </>
  )
}`,
      },
    ],
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Template 4: Photography Studio
// ─────────────────────────────────────────────────────────────────────────────
function photographyStudio(): Template {
  return {
    id: 'photography-studio',
    name: 'Photography Studio',
    description: 'An image-led portfolio for photographers with a refined editorial presentation.',
    category: 'Portfolio',
    accentColor: '#111111',
    highlights: [
      'Full-bleed hero with atmospheric cover photography',
      'Masonry-style gallery with lightbox preview',
      'Editorial about section with portrait and client stats',
      'Elegant booking inquiry form',
    ],
    files: [
      {
        path: 'src/styles/theme.css',
        language: 'css',
        code: `*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
html{scroll-behavior:smooth}
body{font-family:'Georgia',serif;background:#fefefe;color:#111;line-height:1.65;overflow-x:hidden}
a{color:inherit;text-decoration:none}
button{cursor:pointer;border:none;background:none;font:inherit;color:inherit}

:root{--bg:#fefefe;--bg-2:#f5f5f3;--border:#e0ddd8;--text:#111;--muted:#888;--accent:#111;--r:4px;--r-lg:8px}

.navbar{position:fixed;top:0;left:0;right:0;z-index:100;padding:0 2.5rem;height:60px;display:flex;align-items:center;justify-content:space-between;transition:background .3s}
.navbar.scrolled{background:rgba(254,254,254,.95);backdrop-filter:blur(12px);border-bottom:1px solid var(--border)}
.nav-logo{font-size:1rem;font-weight:400;letter-spacing:.18em;text-transform:uppercase}
.nav-links{display:flex;gap:2.5rem}
.nav-link{font-size:.8rem;letter-spacing:.12em;text-transform:uppercase;color:var(--muted);transition:color .2s}
.nav-link:hover,.nav-link-white:hover{opacity:.7}
.nav-book{font-size:.8rem;letter-spacing:.12em;text-transform:uppercase;border-bottom:1px solid currentColor;padding-bottom:2px;transition:opacity .2s}
.nav-book:hover{opacity:.6}

.hero{position:relative;height:100vh;overflow:hidden}
.hero-img{width:100%;height:100%;object-fit:cover;display:block}
.hero-overlay{position:absolute;inset:0;background:linear-gradient(to bottom,rgba(0,0,0,.15) 0%,rgba(0,0,0,.55) 100%)}
.hero-content{position:absolute;bottom:4rem;left:2.5rem;color:#fff}
.hero-eyebrow{font-size:.7rem;letter-spacing:.2em;text-transform:uppercase;opacity:.75;margin-bottom:.75rem}
.hero-name{font-size:clamp(2.5rem,5vw,4rem);font-weight:400;letter-spacing:-.02em;line-height:1.05;margin-bottom:.5rem}
.hero-tagline{font-size:1rem;opacity:.75;font-style:italic}
.hero-scroll{position:absolute;bottom:2rem;right:2.5rem;color:#fff;font-size:.7rem;letter-spacing:.15em;text-transform:uppercase;opacity:.6;display:flex;flex-direction:column;align-items:center;gap:.5rem}
.hero-scroll-line{width:1px;height:40px;background:rgba(255,255,255,.5)}

.section{padding:6rem 2.5rem}.container{max-width:1200px;margin:0 auto}
.section-eyebrow{font-size:.7rem;letter-spacing:.18em;text-transform:uppercase;color:var(--muted);margin-bottom:1rem}

.gallery-tabs{display:flex;gap:2rem;margin-bottom:3rem;border-bottom:1px solid var(--border)}
.gallery-tab{font-size:.8rem;letter-spacing:.12em;text-transform:uppercase;color:var(--muted);padding-bottom:1rem;border-bottom:2px solid transparent;margin-bottom:-1px;transition:all .2s;background:none;border-left:none;border-right:none;border-top:none;cursor:pointer}
.gallery-tab:hover{color:var(--text)}
.gallery-tab.active{color:var(--text);border-bottom:2px solid var(--text)}
.gallery-grid{columns:3;gap:1rem}
.gallery-item{break-inside:avoid;margin-bottom:1rem;overflow:hidden;cursor:pointer;position:relative}
.gallery-item img{width:100%;display:block;transition:transform .4s ease}
.gallery-item:hover img{transform:scale(1.03)}
.gallery-item-overlay{position:absolute;inset:0;background:rgba(0,0,0,0);transition:background .3s;display:flex;align-items:center;justify-content:center}
.gallery-item:hover .gallery-item-overlay{background:rgba(0,0,0,.25)}
.gallery-item-label{color:#fff;font-size:.75rem;letter-spacing:.12em;text-transform:uppercase;opacity:0;transition:opacity .3s}
.gallery-item:hover .gallery-item-label{opacity:1}

.lightbox{position:fixed;inset:0;background:rgba(0,0,0,.9);z-index:500;display:flex;align-items:center;justify-content:center;animation:fadeIn .2s}
@keyframes fadeIn{from{opacity:0}to{opacity:1}}
.lightbox-close{position:absolute;top:2rem;right:2rem;color:#fff;font-size:1.5rem;opacity:.7;transition:opacity .2s;background:none;border:none;cursor:pointer}
.lightbox-close:hover{opacity:1}
.lightbox img{max-width:90vw;max-height:85vh;object-fit:contain}
.lightbox-caption{position:absolute;bottom:2rem;left:50%;transform:translateX(-50%);color:rgba(255,255,255,.6);font-size:.8rem;letter-spacing:.1em;text-transform:uppercase}

.about-grid{display:grid;grid-template-columns:1fr 1fr;gap:6rem;align-items:center}
.about-img{width:100%;aspect-ratio:3/4;overflow:hidden;border-radius:var(--r-lg)}
.about-img img{width:100%;height:100%;object-fit:cover}
.about-eyebrow{font-size:.7rem;letter-spacing:.18em;text-transform:uppercase;color:var(--muted);margin-bottom:1.25rem}
.about-heading{font-size:clamp(1.5rem,2.5vw,2rem);font-weight:400;letter-spacing:-.02em;margin-bottom:1.5rem;line-height:1.25}
.about-text{font-size:.95rem;color:var(--muted);line-height:1.85;margin-bottom:1.5rem}
.about-stats{display:flex;gap:3rem;margin-top:2.5rem;padding-top:2.5rem;border-top:1px solid var(--border)}
.about-stat-num{font-size:2rem;font-weight:400;letter-spacing:-.03em;display:block}
.about-stat-label{font-size:.75rem;letter-spacing:.1em;text-transform:uppercase;color:var(--muted)}

.contact-section{background:var(--bg-2)}
.contact-inner{max-width:640px;margin:0 auto;text-align:center;padding:6rem 2rem}
.contact-heading{font-size:clamp(1.5rem,2.5vw,2.25rem);font-weight:400;letter-spacing:-.02em;margin-bottom:.75rem}
.contact-sub{font-size:.95rem;color:var(--muted);margin-bottom:3rem;line-height:1.7}
.form-row{display:grid;grid-template-columns:1fr 1fr;gap:1rem;margin-bottom:1rem}
.form-field{text-align:left;margin-bottom:1rem}
.form-label{display:block;font-size:.7rem;letter-spacing:.12em;text-transform:uppercase;color:var(--muted);margin-bottom:.5rem}
.form-input,.form-select,.form-textarea{width:100%;padding:.75rem 1rem;background:var(--bg);border:1px solid var(--border);border-radius:var(--r);color:var(--text);font:inherit;font-size:.9rem;font-family:'Georgia',serif;transition:border-color .2s}
.form-input:focus,.form-select:focus,.form-textarea:focus{outline:none;border-color:var(--text)}
.form-textarea{height:120px;resize:vertical}
.btn-submit{margin-top:.5rem;padding:.875rem 3rem;background:var(--text);color:var(--bg);border-radius:var(--r);font-size:.8rem;font-family:'Georgia',serif;letter-spacing:.12em;text-transform:uppercase;transition:opacity .2s;cursor:pointer}
.btn-submit:hover{opacity:.75}

.site-footer{padding:2rem 2.5rem;border-top:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;font-size:.75rem;letter-spacing:.1em;text-transform:uppercase;color:var(--muted)}
.footer-socials{display:flex;gap:1.5rem}
.footer-social{transition:color .2s}.footer-social:hover{color:var(--text)}

@media(max-width:900px){.about-grid{grid-template-columns:1fr;gap:3rem}.gallery-grid{columns:2}.form-row{grid-template-columns:1fr}}
@media(max-width:640px){.nav-links{display:none}.gallery-grid{columns:1}}`,
      },
      {
        path: 'src/App.tsx',
        language: 'tsx',
        code: `import Navbar from './components/Navbar'
import Hero from './components/Hero'
import Gallery from './components/Gallery'
import About from './components/About'
import Contact from './components/Contact'
import './styles/theme.css'

export default function App() {
  return (
    <div>
      <Navbar />
      <Hero />
      <Gallery />
      <About />
      <Contact />
      <footer className="site-footer">
        <span>© 2025 Maya Sorel Photography</span>
        <div className="footer-socials">
          <a href="#" className="footer-social">Instagram</a>
          <a href="#" className="footer-social">Behance</a>
          <a href="#" className="footer-social">500px</a>
        </div>
      </footer>
    </div>
  )
}`,
      },
      {
        path: 'src/components/Navbar.tsx',
        language: 'tsx',
        code: `import { useState, useEffect } from 'react'

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 80)
    window.addEventListener('scroll', fn)
    return () => window.removeEventListener('scroll', fn)
  }, [])
  const white = !scrolled
  return (
    <nav className={\`navbar\${scrolled ? ' scrolled' : ''}\`} style={{ color: white ? '#fff' : 'var(--text)' }}>
      <a href="#" className="nav-logo">Maya Sorel</a>
      <div className="nav-links">
        {['Work', 'About', 'Contact'].map(l => (
          <a key={l} href={\`#\${l.toLowerCase()}\`} className="nav-link" style={{ color: white ? 'rgba(255,255,255,.75)' : undefined }}>{l}</a>
        ))}
      </div>
      <a href="#contact" className="nav-book" style={{ color: white ? '#fff' : 'var(--text)', borderColor: white ? '#fff' : 'var(--text)' }}>Book a session</a>
    </nav>
  )
}`,
      },
      {
        path: 'src/components/Hero.tsx',
        language: 'tsx',
        code: `export default function Hero() {
  return (
    <section className="hero">
      <img className="hero-img" src="https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=1800&q=80&auto=format&fit=crop" alt="Hero" />
      <div className="hero-overlay" />
      <div className="hero-content">
        <p className="hero-eyebrow">Fine art & portrait photography</p>
        <h1 className="hero-name">Maya Sorel</h1>
        <p className="hero-tagline">Capturing light, emotion, and the in-between</p>
      </div>
      <div className="hero-scroll">
        <div className="hero-scroll-line" />
        scroll
      </div>
    </section>
  )
}`,
      },
      {
        path: 'src/components/Gallery.tsx',
        language: 'tsx',
        code: `import { useState } from 'react'

const PHOTOS = [
  { id: 1, src: 'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=800&q=80&auto=format&fit=crop', label: 'Portrait Series', cat: 'Portraits' },
  { id: 2, src: 'https://images.unsplash.com/photo-1554080353-a576cf803bda?w=800&q=80&auto=format&fit=crop', label: 'Golden Hour', cat: 'Landscapes' },
  { id: 3, src: 'https://images.unsplash.com/photo-1502877338535-766e1452684a?w=800&q=80&auto=format&fit=crop', label: 'Urban Motion', cat: 'Street' },
  { id: 4, src: 'https://images.unsplash.com/photo-1470252649378-9c29740c9fa8?w=800&q=80&auto=format&fit=crop', label: 'Misty Morning', cat: 'Landscapes' },
  { id: 5, src: 'https://images.unsplash.com/photo-1509909756405-be0199881695?w=800&q=80&auto=format&fit=crop', label: 'The Look', cat: 'Portraits' },
  { id: 6, src: 'https://images.unsplash.com/photo-1448375240586-882707db888b?w=800&q=80&auto=format&fit=crop', label: 'Forest Light', cat: 'Landscapes' },
  { id: 7, src: 'https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?w=800&q=80&auto=format&fit=crop', label: 'City Nights', cat: 'Street' },
  { id: 8, src: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=800&q=80&auto=format&fit=crop', label: 'Studio Session', cat: 'Portraits' },
  { id: 9, src: 'https://images.unsplash.com/photo-1493246507139-91e8fad9978e?w=800&q=80&auto=format&fit=crop', label: 'Mountain Lake', cat: 'Landscapes' },
]
const TABS = ['All', 'Portraits', 'Landscapes', 'Street']

export default function Gallery() {
  const [tab, setTab] = useState('All')
  const [lightbox, setLightbox] = useState<typeof PHOTOS[0] | null>(null)
  const filtered = tab === 'All' ? PHOTOS : PHOTOS.filter(p => p.cat === tab)
  return (
    <section className="section" id="work">
      <div className="container">
        <p className="section-eyebrow">Selected work</p>
        <div className="gallery-tabs">
          {TABS.map(t => (
            <button key={t} className={\`gallery-tab\${tab === t ? ' active' : ''}\`} onClick={() => setTab(t)} type="button">{t}</button>
          ))}
        </div>
        <div className="gallery-grid">
          {filtered.map(p => (
            <div key={p.id} className="gallery-item" onClick={() => setLightbox(p)}>
              <img src={p.src} alt={p.label} loading="lazy" />
              <div className="gallery-item-overlay">
                <span className="gallery-item-label">{p.label}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
      {lightbox && (
        <div className="lightbox" onClick={() => setLightbox(null)}>
          <button className="lightbox-close" type="button" onClick={() => setLightbox(null)}>✕</button>
          <img src={lightbox.src.replace('w=800', 'w=1400')} alt={lightbox.label} />
          <span className="lightbox-caption">{lightbox.label}</span>
        </div>
      )}
    </section>
  )
}`,
      },
      {
        path: 'src/components/About.tsx',
        language: 'tsx',
        code: `export default function About() {
  return (
    <section className="section" id="about" style={{ background: 'var(--bg-2)' }}>
      <div className="container">
        <div className="about-grid">
          <div className="about-img">
            <img src="https://images.unsplash.com/photo-1502767882945-b43c6e93ddb8?w=800&q=80&auto=format&fit=crop" alt="Maya Sorel" />
          </div>
          <div>
            <p className="about-eyebrow">About the artist</p>
            <h2 className="about-heading">I find the extraordinary in the everyday</h2>
            <p className="about-text">Based in Amsterdam, I've been photographing people, places, and fleeting moments for over a decade. My work spans editorial portraiture, landscape, and documentary — always searching for the quiet truth in a frame.</p>
            <p className="about-text">I work with natural light whenever possible, believing that the best photographs aren't taken — they're discovered. My clients include The New York Times, Vogue, and independent artists worldwide.</p>
            <div className="about-stats">
              <div><span className="about-stat-num">340+</span><span className="about-stat-label">Projects</span></div>
              <div><span className="about-stat-num">12</span><span className="about-stat-label">Countries</span></div>
              <div><span className="about-stat-num">8</span><span className="about-stat-label">Awards</span></div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}`,
      },
      {
        path: 'src/components/Contact.tsx',
        language: 'tsx',
        code: `import { useState } from 'react'

export default function Contact() {
  const [sent, setSent] = useState(false)
  return (
    <section className="contact-section" id="contact">
      <div className="contact-inner">
        {sent ? (
          <div style={{ padding: '3rem 0', textAlign: 'center' }}>
            <p style={{ fontSize: '1.5rem', fontWeight: 400, letterSpacing: '-.02em', marginBottom: '.75rem' }}>Thank you.</p>
            <p style={{ color: 'var(--muted)', fontSize: '.9rem' }}>I'll be in touch within 2 business days.</p>
          </div>
        ) : (
          <>
            <h2 className="contact-heading">Let's create something together</h2>
            <p className="contact-sub">Whether it's a portrait session, editorial shoot, or licensing inquiry — I'd love to hear from you.</p>
            <form onSubmit={e => { e.preventDefault(); setSent(true) }}>
              <div className="form-row">
                <div className="form-field">
                  <label className="form-label" htmlFor="c-name">Name</label>
                  <input id="c-name" className="form-input" type="text" placeholder="Your name" required />
                </div>
                <div className="form-field">
                  <label className="form-label" htmlFor="c-email">Email</label>
                  <input id="c-email" className="form-input" type="email" placeholder="you@email.com" required />
                </div>
              </div>
              <div className="form-field">
                <label className="form-label" htmlFor="c-type">Session type</label>
                <select id="c-type" className="form-select">
                  <option>Portrait / Headshot</option>
                  <option>Editorial</option>
                  <option>Landscape / Travel</option>
                  <option>Licensing inquiry</option>
                  <option>Other</option>
                </select>
              </div>
              <div className="form-field">
                <label className="form-label" htmlFor="c-msg">Message</label>
                <textarea id="c-msg" className="form-textarea" placeholder="Tell me about your project…" required />
              </div>
              <button type="submit" className="btn-submit">Send inquiry</button>
            </form>
          </>
        )}
      </div>
    </section>
  )
}`,
      },
    ],
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Template 5: Restaurant Landing
// ─────────────────────────────────────────────────────────────────────────────
function restaurantLanding(): Template {
  return {
    id: 'restaurant-landing',
    name: 'Restaurant Landing',
    description: 'A refined restaurant website with cinematic imagery, menu browsing, and reservations.',
    category: 'Restaurant',
    accentColor: '#c9883a',
    highlights: [
      'Cinematic hero with real restaurant photography',
      'Interactive menu with categories and dish photography',
      'Reservation form with service time and party size',
      'Chef story, press mentions, and luxury footer',
    ],
    files: [
      {
        path: 'src/styles/theme.css',
        language: 'css',
        code: `*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
html{scroll-behavior:smooth}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',system-ui,sans-serif;background:#0d0a06;color:#f0ead9;line-height:1.65;overflow-x:hidden}
a{color:inherit;text-decoration:none}
button{cursor:pointer;border:none;background:none;font:inherit;color:inherit}
::selection{background:rgba(201,136,58,.3)}

:root{--bg:#0d0a06;--bg-2:#141007;--bg-3:#1c1509;--border:rgba(240,234,217,.12);--text:#f0ead9;--muted:#8a7e6a;--gold:#c9883a;--gold-light:rgba(201,136,58,.15);--gold-glow:rgba(201,136,58,.3);--r:6px;--r-lg:12px;--r-xl:20px}

.navbar{position:fixed;top:0;left:0;right:0;z-index:100;padding:0 2.5rem;height:72px;display:flex;align-items:center;justify-content:space-between;transition:all .3s}
.navbar.scrolled{background:rgba(13,10,6,.92);backdrop-filter:blur(20px);border-bottom:1px solid var(--border)}
.nav-logo{text-align:center}
.nav-logo-name{display:block;font-size:1.1rem;font-weight:700;letter-spacing:.12em;text-transform:uppercase}
.nav-logo-sub{display:block;font-size:.6rem;letter-spacing:.3em;text-transform:uppercase;color:var(--gold);margin-top:.1rem}
.nav-links{display:flex;gap:2.5rem}
.nav-link{font-size:.75rem;letter-spacing:.12em;text-transform:uppercase;color:var(--muted);transition:color .2s}
.nav-link:hover{color:var(--text)}
.nav-reserve{padding:.55rem 1.25rem;border:1px solid var(--gold);color:var(--gold);border-radius:var(--r);font-size:.75rem;letter-spacing:.1em;text-transform:uppercase;transition:all .2s}
.nav-reserve:hover{background:var(--gold);color:#0d0a06}

.hero{position:relative;height:100vh;min-height:600px;overflow:hidden;display:flex;align-items:center;justify-content:center}
.hero-img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.hero-overlay{position:absolute;inset:0;background:linear-gradient(to bottom,rgba(13,10,6,.3) 0%,rgba(13,10,6,.7) 60%,rgba(13,10,6,1) 100%)}
.hero-content{position:relative;z-index:1;text-align:center;padding:2rem}
.hero-eyebrow{font-size:.7rem;letter-spacing:.3em;text-transform:uppercase;color:var(--gold);margin-bottom:1.5rem}
.hero-divider{width:40px;height:1px;background:var(--gold);margin:0 auto 1.5rem}
.hero-heading{font-size:clamp(3rem,7vw,6rem);font-weight:300;letter-spacing:-.01em;line-height:1.05;margin-bottom:1.5rem}
.hero-heading em{font-style:italic;color:var(--gold)}
.hero-sub{font-size:1rem;color:var(--muted);max-width:440px;margin:0 auto 2.5rem;line-height:1.75}
.hero-actions{display:flex;gap:1rem;justify-content:center;flex-wrap:wrap}
.btn-reserve{padding:.875rem 2.5rem;background:var(--gold);color:#0d0a06;border-radius:var(--r);font-weight:700;font-size:.85rem;letter-spacing:.08em;text-transform:uppercase;transition:all .2s}
.btn-reserve:hover{background:#d99840;transform:translateY(-1px);box-shadow:0 6px 24px var(--gold-glow)}
.btn-menu-link{padding:.875rem 2rem;border:1px solid var(--border);color:var(--text);border-radius:var(--r);font-size:.85rem;letter-spacing:.08em;text-transform:uppercase;transition:all .2s}
.btn-menu-link:hover{border-color:var(--gold);color:var(--gold)}
.hero-hours{position:absolute;bottom:2.5rem;left:50%;transform:translateX(-50%);display:flex;gap:3rem;font-size:.7rem;letter-spacing:.15em;text-transform:uppercase;color:var(--muted);white-space:nowrap}

.section{padding:6rem 2rem}.container{max-width:1100px;margin:0 auto}
.section-eyebrow{font-size:.65rem;letter-spacing:.25em;text-transform:uppercase;color:var(--gold);margin-bottom:.75rem;text-align:center}
.section-heading{font-size:clamp(1.75rem,3vw,2.75rem);font-weight:300;letter-spacing:-.01em;text-align:center;margin-bottom:.75rem}
.section-divider{width:40px;height:1px;background:var(--gold);margin:1rem auto 3.5rem}

.menu-tabs{display:flex;justify-content:center;gap:.75rem;flex-wrap:wrap;margin-bottom:3rem}
.menu-tab{padding:.5rem 1.5rem;border:1px solid var(--border);border-radius:999px;font-size:.75rem;letter-spacing:.1em;text-transform:uppercase;color:var(--muted);transition:all .2s}
.menu-tab:hover{border-color:var(--gold);color:var(--gold)}
.menu-tab.active{background:var(--gold);border-color:var(--gold);color:#0d0a06}
.menu-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:1px;background:var(--border)}
.menu-item{background:var(--bg-2);padding:1.75rem;transition:background .2s}
.menu-item:hover{background:var(--bg-3)}
.menu-item-img{width:100%;height:180px;border-radius:var(--r-lg);overflow:hidden;margin-bottom:1.25rem}
.menu-item-img img{width:100%;height:100%;object-fit:cover;transition:transform .4s}
.menu-item:hover .menu-item-img img{transform:scale(1.04)}
.menu-item-top{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:.35rem}
.menu-item-name{font-size:1rem;font-weight:500}
.menu-item-price{font-size:1rem;color:var(--gold);font-weight:600}
.menu-item-desc{font-size:.85rem;color:var(--muted);line-height:1.65}
.menu-item-tag{display:inline-block;font-size:.6rem;letter-spacing:.1em;text-transform:uppercase;padding:.2rem .6rem;border-radius:4px;background:var(--gold-light);color:var(--gold);margin-top:.75rem}

.chef-section{background:var(--bg-2)}
.chef-grid{display:grid;grid-template-columns:1fr 1fr;gap:5rem;align-items:center;padding:6rem 2rem;max-width:1100px;margin:0 auto}
.chef-img{position:relative}
.chef-img img{width:100%;aspect-ratio:2/3;object-fit:cover;border-radius:var(--r-xl)}
.chef-quote-card{position:absolute;bottom:-1.5rem;right:-1.5rem;background:var(--gold);color:#0d0a06;padding:1.25rem 1.5rem;border-radius:var(--r-lg);max-width:220px;font-size:.85rem;font-weight:600;line-height:1.5}
.chef-quote-mark{font-size:2rem;line-height:1;display:block;margin-bottom:.25rem}
.chef-eyebrow{font-size:.65rem;letter-spacing:.25em;text-transform:uppercase;color:var(--gold);margin-bottom:.75rem}
.chef-name{font-size:clamp(1.5rem,2.5vw,2.25rem);font-weight:300;letter-spacing:-.01em;margin-bottom:1.25rem}
.chef-text{font-size:.95rem;color:var(--muted);line-height:1.8;margin-bottom:1rem}
.press-mentions{margin-top:2.5rem;padding-top:2rem;border-top:1px solid var(--border)}
.press-label{font-size:.65rem;letter-spacing:.2em;text-transform:uppercase;color:var(--muted);margin-bottom:.875rem}
.press-logos{display:flex;gap:2rem;flex-wrap:wrap;align-items:center}
.press-name{font-size:.85rem;color:var(--muted);font-style:italic}

.reservation-section{padding:6rem 2rem}
.reservation-inner{max-width:640px;margin:0 auto}
.res-form{background:var(--bg-2);border:1px solid var(--border);border-radius:var(--r-xl);padding:2.5rem}
.res-row{display:grid;grid-template-columns:1fr 1fr;gap:1rem;margin-bottom:1rem}
.res-field{margin-bottom:1rem}
.res-label{display:block;font-size:.65rem;letter-spacing:.15em;text-transform:uppercase;color:var(--muted);margin-bottom:.5rem}
.res-input,.res-select{width:100%;padding:.75rem 1rem;background:var(--bg-3);border:1px solid var(--border);border-radius:var(--r);color:var(--text);font:inherit;font-size:.9rem;transition:border-color .2s}
.res-input:focus,.res-select:focus{outline:none;border-color:var(--gold)}
.res-select option{background:var(--bg-3)}
.res-btn{width:100%;padding:1rem;background:var(--gold);color:#0d0a06;border-radius:var(--r-lg);font-weight:700;font-size:.9rem;letter-spacing:.08em;text-transform:uppercase;transition:all .2s;margin-top:.5rem;cursor:pointer}
.res-btn:hover{background:#d99840}
.res-note{text-align:center;font-size:.75rem;color:var(--muted);margin-top:1rem}

.site-footer{padding:2rem 2.5rem;border-top:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;font-size:.75rem;letter-spacing:.1em;text-transform:uppercase;color:var(--muted)}

@media(max-width:900px){.chef-grid{grid-template-columns:1fr;gap:3rem}.menu-grid{grid-template-columns:1fr}.chef-quote-card{display:none}.res-row{grid-template-columns:1fr}}
@media(max-width:640px){.nav-links{display:none}.hero-hours{gap:1.5rem;font-size:.6rem}}`,
      },
      {
        path: 'src/App.tsx',
        language: 'tsx',
        code: `import Navbar from './components/Navbar'
import Hero from './components/Hero'
import Menu from './components/Menu'
import Chef from './components/Chef'
import Reservation from './components/Reservation'
import './styles/theme.css'

export default function App() {
  return (
    <div>
      <Navbar />
      <Hero />
      <Menu />
      <Chef />
      <Reservation />
      <footer className="site-footer">
        <span>© 2025 Aurore — 14 Rue des Martyrs, Paris</span>
        <span>+33 1 42 00 00 00</span>
      </footer>
    </div>
  )
}`,
      },
      {
        path: 'src/components/Navbar.tsx',
        language: 'tsx',
        code: `import { useState, useEffect } from 'react'

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 60)
    window.addEventListener('scroll', fn)
    return () => window.removeEventListener('scroll', fn)
  }, [])
  return (
    <nav className={\`navbar\${scrolled ? ' scrolled' : ''}\`}>
      <div className="nav-links">
        <a href="#menu" className="nav-link">Menu</a>
        <a href="#chef" className="nav-link">Our story</a>
      </div>
      <a href="#" className="nav-logo">
        <span className="nav-logo-name">Aurore</span>
        <span className="nav-logo-sub">Paris · Est. 2018</span>
      </a>
      <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
        <a href="#" className="nav-link">Press</a>
        <a href="#reservation" className="nav-reserve">Reserve</a>
      </div>
    </nav>
  )
}`,
      },
      {
        path: 'src/components/Hero.tsx',
        language: 'tsx',
        code: `export default function Hero() {
  return (
    <section className="hero">
      <img className="hero-img" src="https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=1800&q=80&auto=format&fit=crop" alt="Restaurant interior" />
      <div className="hero-overlay" />
      <div className="hero-content">
        <p className="hero-eyebrow">Gastronomie française contemporaine</p>
        <div className="hero-divider" />
        <h1 className="hero-heading">Where every dish<br />tells a <em>story</em></h1>
        <p className="hero-sub">Seasonal ingredients, classical technique, and a deep respect for produce — served in an intimate Montmartre setting.</p>
        <div className="hero-actions">
          <a href="#reservation" className="btn-reserve">Reserve a table</a>
          <a href="#menu" className="btn-menu-link">View menu</a>
        </div>
      </div>
      <div className="hero-hours">
        <span>Lunch: 12:00 – 14:30</span>
        <span>·</span>
        <span>Dinner: 19:00 – 22:30</span>
        <span>·</span>
        <span>Montmartre, Paris</span>
      </div>
    </section>
  )
}`,
      },
      {
        path: 'src/components/Menu.tsx',
        language: 'tsx',
        code: `import { useState } from 'react'

const DISHES = {
  Starters: [
    { name: 'Foie Gras Torchon', price: '€28', desc: 'Sauternes gelée, brioche, Périgord truffle shavings', tag: 'Signature', img: 'https://images.unsplash.com/photo-1559847844-5315695dadae?w=600&q=80&auto=format&fit=crop' },
    { name: 'Burrata & Heirloom Tomatoes', price: '€18', desc: 'Aged balsamic, fresh basil oil, Maldon sea salt', img: 'https://images.unsplash.com/photo-1608897013039-887f21d8c804?w=600&q=80&auto=format&fit=crop' },
    { name: "Soupe à l'Oignon Gratinée", price: '€16', desc: 'Slow-cooked Cévennes onions, Gruyère croûte', tag: 'Seasonal', img: 'https://images.unsplash.com/photo-1547592166-23ac45744acd?w=600&q=80&auto=format&fit=crop' },
    { name: 'Tuna Tartare', price: '€24', desc: 'Sesame, cucumber, wasabi crème, crispy wonton', img: 'https://images.unsplash.com/photo-1611599537845-1c7aca0091c0?w=600&q=80&auto=format&fit=crop' },
  ],
  Mains: [
    { name: 'Duck Confit', price: '€38', desc: 'Sarladaise potatoes, cherry jus, micro herbs', tag: 'Bestseller', img: 'https://images.unsplash.com/photo-1432139509613-5c4255815697?w=600&q=80&auto=format&fit=crop' },
    { name: 'Sole Meunière', price: '€42', desc: 'Brown butter, capers, lemon, parsley potatoes', img: 'https://images.unsplash.com/photo-1467003909585-2f8a72700288?w=600&q=80&auto=format&fit=crop' },
    { name: 'Côte de Boeuf (for 2)', price: '€89', desc: '800g aged Charolais, béarnaise, truffle fries', tag: 'Signature', img: 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=600&q=80&auto=format&fit=crop' },
    { name: 'Risotto aux Champignons', price: '€29', desc: 'Wild mushroom, aged Parmesan, truffle oil', tag: 'Vegetarian', img: 'https://images.unsplash.com/photo-1476124369491-e7addf5db371?w=600&q=80&auto=format&fit=crop' },
  ],
  Desserts: [
    { name: 'Tarte Tatin', price: '€14', desc: 'Caramelised apple, crème fraîche, vanilla ice cream', tag: 'Classic', img: 'https://images.unsplash.com/photo-1568571780765-9276ac8b75a2?w=600&q=80&auto=format&fit=crop' },
    { name: 'Chocolate Fondant', price: '€16', desc: 'Valrhona 70%, praline heart, vanilla anglaise', tag: 'Signature', img: 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=600&q=80&auto=format&fit=crop' },
    { name: 'Île Flottante', price: '€12', desc: 'Soft meringue, crème anglaise, caramel, praline', img: 'https://images.unsplash.com/photo-1488477181946-6428a0291777?w=600&q=80&auto=format&fit=crop' },
    { name: 'Cheese Selection', price: '€22', desc: 'Five French cheeses, walnut bread, quince paste', img: 'https://images.unsplash.com/photo-1452195100486-9cc805987862?w=600&q=80&auto=format&fit=crop' },
  ],
}

export default function Menu() {
  const [tab, setTab] = useState<keyof typeof DISHES>('Mains')
  const dishes = DISHES[tab]
  return (
    <section className="section" id="menu">
      <div className="container">
        <p className="section-eyebrow">À la carte</p>
        <h2 className="section-heading">The Menu</h2>
        <div className="section-divider" />
        <div className="menu-tabs">
          {(Object.keys(DISHES) as (keyof typeof DISHES)[]).map(k => (
            <button key={k} className={\`menu-tab\${tab === k ? ' active' : ''}\`} onClick={() => setTab(k)} type="button">{k}</button>
          ))}
        </div>
        <div className="menu-grid">
          {dishes.map(d => (
            <div key={d.name} className="menu-item">
              <div className="menu-item-img"><img src={d.img} alt={d.name} loading="lazy" /></div>
              <div className="menu-item-top">
                <span className="menu-item-name">{d.name}</span>
                <span className="menu-item-price">{d.price}</span>
              </div>
              <p className="menu-item-desc">{d.desc}</p>
              {d.tag && <span className="menu-item-tag">{d.tag}</span>}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}`,
      },
      {
        path: 'src/components/Chef.tsx',
        language: 'tsx',
        code: `export default function Chef() {
  return (
    <section className="chef-section" id="chef">
      <div className="chef-grid">
        <div className="chef-img">
          <img src="https://images.unsplash.com/photo-1577219491135-ce391730fb2c?w=800&q=80&auto=format&fit=crop" alt="Chef Laurent Moreau" />
          <div className="chef-quote-card">
            <span className="chef-quote-mark">"</span>
            Cuisine is not about perfection. It's about honesty.
          </div>
        </div>
        <div>
          <p className="chef-eyebrow">The chef</p>
          <h2 className="chef-name">Laurent Moreau</h2>
          <p className="chef-text">Trained under Alain Ducasse in Monaco and Joel Robuchon in Paris, Laurent returned to his hometown of Lyon before opening Aurore in 2018.</p>
          <p className="chef-text">His cooking is rooted in the French canon — but never trapped by it. Every dish reflects a personal memory, a market discovery, or a dialogue with a local producer.</p>
          <div className="press-mentions">
            <p className="press-label">As seen in</p>
            <div className="press-logos">
              {['Le Monde', 'Condé Nast Traveler', 'The Guardian', 'Michelin Guide'].map(p => (
                <span key={p} className="press-name">{p}</span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}`,
      },
      {
        path: 'src/components/Reservation.tsx',
        language: 'tsx',
        code: `import { useState } from 'react'

export default function Reservation() {
  const [confirmed, setConfirmed] = useState(false)
  return (
    <section className="reservation-section" id="reservation">
      <div className="reservation-inner">
        <p className="section-eyebrow">Book a table</p>
        <h2 className="section-heading">Reserve your evening</h2>
        <div className="section-divider" />
        <div className="res-form">
          {confirmed ? (
            <div style={{ textAlign: 'center', padding: '2rem 0' }}>
              <p style={{ fontSize: '1.25rem', marginBottom: '.75rem' }}>Reservation confirmed ✓</p>
              <p style={{ color: 'var(--muted)', fontSize: '.9rem' }}>A confirmation has been sent to your email. We look forward to welcoming you.</p>
            </div>
          ) : (
            <form onSubmit={e => { e.preventDefault(); setConfirmed(true) }}>
              <div className="res-row">
                <div className="res-field">
                  <label className="res-label" htmlFor="r-name">Name</label>
                  <input id="r-name" className="res-input" type="text" placeholder="Full name" required />
                </div>
                <div className="res-field">
                  <label className="res-label" htmlFor="r-email">Email</label>
                  <input id="r-email" className="res-input" type="email" placeholder="you@email.com" required />
                </div>
              </div>
              <div className="res-row">
                <div className="res-field">
                  <label className="res-label" htmlFor="r-date">Date</label>
                  <input id="r-date" className="res-input" type="date" required />
                </div>
                <div className="res-field">
                  <label className="res-label" htmlFor="r-time">Service</label>
                  <select id="r-time" className="res-select">
                    <option>Lunch — 12:00</option><option>Lunch — 13:00</option>
                    <option>Dinner — 19:00</option><option>Dinner — 20:00</option><option>Dinner — 21:00</option>
                  </select>
                </div>
              </div>
              <div className="res-row">
                <div className="res-field">
                  <label className="res-label" htmlFor="r-guests">Guests</label>
                  <select id="r-guests" className="res-select">
                    {[1,2,3,4,5,6,7,8].map(n => <option key={n}>{n} {n === 1 ? 'guest' : 'guests'}</option>)}
                  </select>
                </div>
                <div className="res-field">
                  <label className="res-label" htmlFor="r-occasion">Occasion</label>
                  <select id="r-occasion" className="res-select">
                    <option>No special occasion</option><option>Birthday</option>
                    <option>Anniversary</option><option>Business dinner</option>
                  </select>
                </div>
              </div>
              <button type="submit" className="res-btn">Confirm reservation</button>
              <p className="res-note">For parties of 9+, please call us directly.</p>
            </form>
          )}
        </div>
      </div>
    </section>
  )
}`,
      },
    ],
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Template 6: Tech Blog
// ─────────────────────────────────────────────────────────────────────────────
function techBlog(): Template {
  return {
    id: 'tech-blog',
    name: 'Tech Blog',
    description: 'A clean editorial blog for technical teams, creators, and thought leaders.',
    category: 'Blog',
    accentColor: '#e85d2f',
    highlights: [
      'Featured hero article with strong cover photography',
      'Article grid with authors, dates, and reading time',
      'Tag filter bar for quick content discovery',
      'Newsletter signup section with confirmation state',
    ],
    files: [
      {
        path: 'src/styles/theme.css',
        language: 'css',
        code: `*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
html{scroll-behavior:smooth}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',system-ui,sans-serif;background:#fff;color:#1a1a1a;line-height:1.65;overflow-x:hidden}
a{color:inherit;text-decoration:none}
button{cursor:pointer;border:none;background:none;font:inherit;color:inherit}

:root{--bg:#fff;--bg-2:#f7f7f5;--bg-3:#f0eeeb;--border:#e8e5e0;--text:#1a1a1a;--muted:#888;--accent:#e85d2f;--accent-light:rgba(232,93,47,.1);--r:6px;--r-lg:12px;--r-xl:20px}

.navbar{position:sticky;top:0;z-index:100;background:rgba(255,255,255,.96);backdrop-filter:blur(12px);border-bottom:1px solid var(--border)}
.navbar-inner{max-width:1200px;margin:0 auto;padding:0 2rem;height:60px;display:flex;align-items:center;justify-content:space-between;gap:2rem}
.nav-logo{font-size:1.2rem;font-weight:900;letter-spacing:-.03em}
.nav-logo-dot{color:var(--accent)}
.nav-search{flex:1;max-width:300px;position:relative}
.nav-search-input{width:100%;padding:.4rem .75rem .4rem 2.25rem;background:var(--bg-2);border:1px solid var(--border);border-radius:999px;font:inherit;font-size:.8rem;color:var(--text);transition:border-color .2s}
.nav-search-input:focus{outline:none;border-color:var(--accent)}
.nav-search-icon{position:absolute;left:.75rem;top:50%;transform:translateY(-50%);font-size:.8rem;color:var(--muted)}
.nav-links{display:flex;align-items:center;gap:.25rem}
.nav-link{padding:.4rem .75rem;font-size:.85rem;color:var(--muted);border-radius:var(--r);transition:all .15s}
.nav-link:hover{color:var(--text);background:var(--bg-2)}
.nav-subscribe{padding:.45rem 1.125rem;background:var(--accent);color:#fff;border-radius:var(--r);font-size:.85rem;font-weight:600;transition:all .2s}
.nav-subscribe:hover{background:#d14e22}

.featured-section{max-width:1200px;margin:0 auto;padding:3rem 2rem 2rem}
.featured-article{display:grid;grid-template-columns:1fr 1fr;gap:3rem;align-items:center;padding:2.5rem;background:var(--bg-2);border-radius:var(--r-xl);border:1px solid var(--border);cursor:pointer;transition:box-shadow .2s}
.featured-article:hover{box-shadow:0 8px 32px rgba(0,0,0,.08)}
.featured-img{border-radius:var(--r-lg);overflow:hidden;aspect-ratio:16/10}
.featured-img img{width:100%;height:100%;object-fit:cover;transition:transform .4s}
.featured-article:hover .featured-img img{transform:scale(1.02)}
.featured-tag{display:inline-flex;align-items:center;padding:.25rem .75rem;background:var(--accent);color:#fff;border-radius:999px;font-size:.7rem;font-weight:700;letter-spacing:.06em;text-transform:uppercase;margin-bottom:1rem}
.featured-heading{font-size:clamp(1.4rem,2.5vw,2rem);font-weight:800;letter-spacing:-.03em;line-height:1.2;margin-bottom:.875rem;transition:color .2s}
.featured-article:hover .featured-heading{color:var(--accent)}
.featured-excerpt{font-size:.95rem;color:var(--muted);line-height:1.75;margin-bottom:1.5rem}
.article-meta{display:flex;align-items:center;gap:1rem}
.author-avatar{width:36px;height:36px;border-radius:50%;overflow:hidden;flex-shrink:0}
.author-avatar img{width:100%;height:100%;object-fit:cover}
.author-name{font-size:.85rem;font-weight:600}
.article-info{font-size:.8rem;color:var(--muted)}
.read-time{color:var(--accent);font-weight:600}

.articles-section{max-width:1200px;margin:0 auto;padding:2rem}
.articles-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:1.5rem;gap:1rem;flex-wrap:wrap}
.articles-title{font-size:1.1rem;font-weight:800;letter-spacing:-.02em}
.tag-filter{display:flex;gap:.5rem;flex-wrap:wrap}
.tag-btn{padding:.35rem .875rem;border:1px solid var(--border);border-radius:999px;font-size:.75rem;color:var(--muted);transition:all .2s}
.tag-btn:hover{border-color:var(--accent);color:var(--accent)}
.tag-btn.active{background:var(--accent);border-color:var(--accent);color:#fff}
.articles-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:1.5rem;margin-top:2rem}
.article-card{border:1px solid var(--border);border-radius:var(--r-xl);overflow:hidden;transition:all .2s;cursor:pointer}
.article-card:hover{transform:translateY(-3px);box-shadow:0 8px 32px rgba(0,0,0,.08)}
.article-card-img{aspect-ratio:16/9;overflow:hidden}
.article-card-img img{width:100%;height:100%;object-fit:cover;transition:transform .4s}
.article-card:hover .article-card-img img{transform:scale(1.04)}
.article-card-body{padding:1.25rem}
.article-card-tags{display:flex;gap:.4rem;flex-wrap:wrap;margin-bottom:.625rem}
.article-card-tag{font-size:.65rem;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--accent)}
.article-card-title{font-size:.95rem;font-weight:700;letter-spacing:-.02em;line-height:1.35;margin-bottom:.5rem;transition:color .2s}
.article-card:hover .article-card-title{color:var(--accent)}
.article-card-excerpt{font-size:.8rem;color:var(--muted);line-height:1.65;margin-bottom:.875rem;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.article-card-meta{display:flex;align-items:center;gap:.6rem}
.article-card-avatar{width:24px;height:24px;border-radius:50%;overflow:hidden;flex-shrink:0}
.article-card-avatar img{width:100%;height:100%;object-fit:cover}
.article-card-author{font-size:.75rem;font-weight:600}
.article-card-dot{color:var(--border)}
.article-card-date{font-size:.75rem;color:var(--muted)}

.newsletter-section{margin:3rem 2rem 0;background:linear-gradient(135deg,#1a1a1a,#2d2d2d);border-radius:var(--r-xl);padding:4rem 3rem;text-align:center;max-width:1156px;margin-left:auto;margin-right:auto}
.newsletter-eyebrow{font-size:.7rem;letter-spacing:.2em;text-transform:uppercase;color:var(--accent);margin-bottom:.75rem}
.newsletter-heading{font-size:clamp(1.5rem,2.5vw,2rem);font-weight:800;letter-spacing:-.03em;color:#fff;margin-bottom:.75rem}
.newsletter-sub{font-size:.95rem;color:rgba(255,255,255,.55);max-width:440px;margin:0 auto 2rem;line-height:1.65}
.newsletter-form{display:flex;gap:.75rem;max-width:440px;margin:0 auto}
.newsletter-input{flex:1;padding:.75rem 1.25rem;background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.15);border-radius:var(--r-lg);color:#fff;font:inherit;font-size:.9rem;transition:border-color .2s}
.newsletter-input::placeholder{color:rgba(255,255,255,.35)}
.newsletter-input:focus{outline:none;border-color:var(--accent)}
.newsletter-btn{padding:.75rem 1.5rem;background:var(--accent);color:#fff;border-radius:var(--r-lg);font-weight:700;font-size:.875rem;white-space:nowrap;transition:all .2s;cursor:pointer}
.newsletter-btn:hover{background:#d14e22}
.newsletter-note{font-size:.75rem;color:rgba(255,255,255,.3);margin-top:1rem}

.site-footer{max-width:1200px;margin:0 auto;padding:2rem;display:flex;align-items:center;justify-content:space-between;border-top:1px solid var(--border);font-size:.8rem;color:var(--muted)}
.footer-links{display:flex;gap:1.5rem}
.footer-link:hover{color:var(--text)}

@media(max-width:1024px){.articles-grid{grid-template-columns:repeat(2,1fr)}}
@media(max-width:768px){.featured-article{grid-template-columns:1fr}.nav-search,.nav-links{display:none}.articles-grid{grid-template-columns:1fr}.newsletter-form{flex-direction:column}}`,
      },
      {
        path: 'src/App.tsx',
        language: 'tsx',
        code: `import Navbar from './components/Navbar'
import FeaturedArticle from './components/FeaturedArticle'
import ArticleGrid from './components/ArticleGrid'
import Newsletter from './components/Newsletter'
import './styles/theme.css'

export default function App() {
  return (
    <div>
      <Navbar />
      <FeaturedArticle />
      <ArticleGrid />
      <Newsletter />
      <footer className="site-footer">
        <span>© 2025 Codex Magazine</span>
        <div className="footer-links">
          {['About', 'Write for us', 'Privacy', 'RSS'].map(l => <a key={l} href="#" className="footer-link">{l}</a>)}
        </div>
      </footer>
    </div>
  )
}`,
      },
      {
        path: 'src/components/Navbar.tsx',
        language: 'tsx',
        code: `export default function Navbar() {
  return (
    <header className="navbar">
      <div className="navbar-inner">
        <a href="#" className="nav-logo">Codex<span className="nav-logo-dot">.</span></a>
        <div className="nav-search">
          <span className="nav-search-icon">🔍</span>
          <input className="nav-search-input" type="text" placeholder="Search articles…" />
        </div>
        <nav className="nav-links">
          <a href="#" className="nav-link">Web Dev</a>
          <a href="#" className="nav-link">AI & ML</a>
          <a href="#" className="nav-link">Design</a>
          <a href="#" className="nav-link">Career</a>
        </nav>
        <a href="#newsletter" className="nav-subscribe">Subscribe</a>
      </div>
    </header>
  )
}`,
      },
      {
        path: 'src/components/FeaturedArticle.tsx',
        language: 'tsx',
        code: `export default function FeaturedArticle() {
  return (
    <section className="featured-section">
      <article className="featured-article">
        <div className="featured-img">
          <img src="https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=1000&q=80&auto=format&fit=crop" alt="Featured article" />
        </div>
        <div>
          <span className="featured-tag">Featured</span>
          <h1 className="featured-heading">Why TypeScript 5.5 Changes How We Think About Type Predicates</h1>
          <p className="featured-excerpt">The new inferred type predicates feature isn't just syntactic sugar — it fundamentally shifts the boundary between runtime checks and compile-time guarantees. Here's what every TypeScript developer needs to know.</p>
          <div className="article-meta">
            <div className="author-avatar">
              <img src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=80&q=80&auto=format&fit=crop" alt="Marcus Webb" />
            </div>
            <div>
              <p className="author-name">Marcus Webb</p>
              <p className="article-info">Jun 4, 2025 · <span className="read-time">8 min read</span></p>
            </div>
          </div>
        </div>
      </article>
    </section>
  )
}`,
      },
      {
        path: 'src/components/ArticleGrid.tsx',
        language: 'tsx',
        code: `import { useState } from 'react'

const ARTICLES = [
  { id: 1, title: 'Building a real-time collaborative editor with CRDTs', excerpt: 'Conflict-free replicated data types sound intimidating, but they unlock a class of distributed apps that OT can never achieve cleanly.', tag: 'Web Dev', date: 'Jun 2', time: '12 min', img: 'https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=600&q=80&auto=format&fit=crop', author: { name: 'Priya Nair', avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=80&q=80&auto=format&fit=crop' } },
  { id: 2, title: 'The State of AI Coding Assistants in 2025', excerpt: 'We benchmarked 7 coding assistants on 400 real-world tasks. The results surprised us — and might change how you work.', tag: 'AI & ML', date: 'May 30', time: '15 min', img: 'https://images.unsplash.com/photo-1677442135703-1787eea5ce01?w=600&q=80&auto=format&fit=crop', author: { name: 'Leo Zhang', avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=80&q=80&auto=format&fit=crop' } },
  { id: 3, title: 'Micro-interactions that make users feel smart', excerpt: "Good UX isn't invisible — it's perceptible but effortless. A guide to designing feedback that empowers instead of distracts.", tag: 'Design', date: 'May 28', time: '7 min', img: 'https://images.unsplash.com/photo-1561070791-2526d30994b5?w=600&q=80&auto=format&fit=crop', author: { name: 'Sofia Rios', avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=80&q=80&auto=format&fit=crop' } },
  { id: 4, title: 'From SWE to Staff: The skills that actually matter', excerpt: "Technical excellence gets you to senior. Here's what takes you to staff — and why most companies measure it wrong.", tag: 'Career', date: 'May 25', time: '10 min', img: 'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=600&q=80&auto=format&fit=crop', author: { name: 'Marcus Webb', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=80&q=80&auto=format&fit=crop' } },
  { id: 5, title: 'CSS Grid subgrid is finally here — use it', excerpt: "Subgrid solves the layout problem that has haunted CSS developers for a decade. Here's every pattern you need to know.", tag: 'Web Dev', date: 'May 22', time: '6 min', img: 'https://images.unsplash.com/photo-1517180102446-f3ece451e9d8?w=600&q=80&auto=format&fit=crop', author: { name: 'Priya Nair', avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=80&q=80&auto=format&fit=crop' } },
  { id: 6, title: 'Fine-tuning vs RAG: the definitive 2025 guide', excerpt: 'Both approaches have their place. We break down the tradeoffs across cost, latency, freshness, and quality with concrete numbers.', tag: 'AI & ML', date: 'May 20', time: '14 min', img: 'https://images.unsplash.com/photo-1620712943543-bcc4688e7485?w=600&q=80&auto=format&fit=crop', author: { name: 'Leo Zhang', avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=80&q=80&auto=format&fit=crop' } },
]
const TAGS = ['All', 'Web Dev', 'AI & ML', 'Design', 'Career']

export default function ArticleGrid() {
  const [active, setActive] = useState('All')
  const filtered = active === 'All' ? ARTICLES : ARTICLES.filter(a => a.tag === active)
  return (
    <section className="articles-section">
      <div className="articles-header">
        <h2 className="articles-title">Latest articles</h2>
        <div className="tag-filter">
          {TAGS.map(t => (
            <button key={t} className={\`tag-btn\${active === t ? ' active' : ''}\`} onClick={() => setActive(t)} type="button">{t}</button>
          ))}
        </div>
      </div>
      <div className="articles-grid">
        {filtered.map(a => (
          <article key={a.id} className="article-card">
            <div className="article-card-img"><img src={a.img} alt={a.title} loading="lazy" /></div>
            <div className="article-card-body">
              <div className="article-card-tags"><span className="article-card-tag">{a.tag}</span></div>
              <h3 className="article-card-title">{a.title}</h3>
              <p className="article-card-excerpt">{a.excerpt}</p>
              <div className="article-card-meta">
                <div className="article-card-avatar"><img src={a.author.avatar} alt={a.author.name} /></div>
                <span className="article-card-author">{a.author.name}</span>
                <span className="article-card-dot">·</span>
                <span className="article-card-date">{a.date} · {a.time}</span>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}`,
      },
      {
        path: 'src/components/Newsletter.tsx',
        language: 'tsx',
        code: `import { useState } from 'react'

export default function Newsletter() {
  const [subscribed, setSubscribed] = useState(false)
  return (
    <section className="newsletter-section" id="newsletter">
      <p className="newsletter-eyebrow">Newsletter</p>
      <h2 className="newsletter-heading">Get the best articles in your inbox</h2>
      <p className="newsletter-sub">Join 28,000 developers and designers who read Codex every week. No spam, unsubscribe any time.</p>
      {subscribed ? (
        <p style={{ color: '#fff', fontSize: '1rem' }}>You're in! Check your inbox to confirm. ✓</p>
      ) : (
        <>
          <form className="newsletter-form" onSubmit={e => { e.preventDefault(); setSubscribed(true) }}>
            <input className="newsletter-input" type="email" placeholder="your@email.com" required />
            <button type="submit" className="newsletter-btn">Subscribe →</button>
          </form>
          <p className="newsletter-note">No spam · Unsubscribe any time · Read by 28k developers</p>
        </>
      )}
    </section>
  )
}`,
      },
    ],
  }
}

// Template 7: Wellness Clinic
function wellnessClinic(): Template {
  return {
    id: 'wellness-clinic',
    name: 'Wellness Clinic',
    description: 'A calm, trustworthy clinic website with services, practitioners, and appointment booking.',
    category: 'SaaS',
    accentColor: '#0f766e',
    highlights: [
      'Warm healthcare hero with real lifestyle imagery',
      'Service cards, practitioner profiles, and clinic stats',
      'Appointment request form with confirmation state',
      'Trust-focused layout for modern wellness practices',
    ],
    files: [
      {
        path: 'src/styles/theme.css',
        language: 'css',
        code: `*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
html{scroll-behavior:smooth}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',system-ui,sans-serif;background:#f8fbf9;color:#10211d;line-height:1.65;overflow-x:hidden}
a{color:inherit;text-decoration:none}button{font:inherit;color:inherit;border:0;background:none;cursor:pointer}
:root{--bg:#f8fbf9;--surface:#fff;--soft:#eef7f3;--ink:#10211d;--muted:#64756f;--line:#dce9e3;--accent:#0f766e;--accent-2:#d97706;--r:8px;--r-lg:14px;--r-xl:20px}
.nav{position:sticky;top:0;z-index:20;background:rgba(248,251,249,.92);backdrop-filter:blur(16px);border-bottom:1px solid var(--line)}
.nav-inner{max-width:1180px;margin:0 auto;height:68px;padding:0 1.5rem;display:flex;align-items:center;justify-content:space-between;gap:1rem}
.brand{font-size:1.05rem;font-weight:800;letter-spacing:-.02em}.brand span{color:var(--accent)}
.nav-links{display:flex;gap:.4rem}.nav-links a{padding:.45rem .8rem;border-radius:var(--r);font-size:.88rem;color:var(--muted)}.nav-links a:hover{background:var(--soft);color:var(--ink)}
.nav-cta{padding:.65rem 1rem;border-radius:var(--r);background:var(--accent);color:#fff;font-size:.88rem;font-weight:700}
.hero{max-width:1180px;margin:0 auto;padding:5rem 1.5rem 4rem;display:grid;grid-template-columns:1fr .92fr;gap:3rem;align-items:center}
.eyebrow{font-size:.72rem;font-weight:800;letter-spacing:.16em;text-transform:uppercase;color:var(--accent);margin-bottom:1rem}
.hero h1{font-size:clamp(2.6rem,5vw,4.7rem);line-height:1.02;letter-spacing:-.045em;margin-bottom:1.25rem}
.hero p{color:var(--muted);font-size:1.05rem;max-width:560px;margin-bottom:2rem}.actions{display:flex;gap:.9rem;flex-wrap:wrap}
.btn-primary,.btn-secondary{display:inline-flex;align-items:center;justify-content:center;min-height:46px;padding:.8rem 1.2rem;border-radius:var(--r);font-weight:750}
.btn-primary{background:var(--accent);color:#fff}.btn-secondary{border:1px solid var(--line);background:#fff;color:var(--ink)}
.hero-media{position:relative}.hero-media img{width:100%;aspect-ratio:4/5;object-fit:cover;border-radius:var(--r-xl);box-shadow:0 24px 70px rgba(16,33,29,.16)}
.metric-card{position:absolute;left:-1rem;bottom:2rem;background:#fff;border:1px solid var(--line);border-radius:var(--r-lg);padding:1rem 1.2rem;box-shadow:0 18px 50px rgba(16,33,29,.14)}
.metric-card strong{display:block;font-size:1.5rem;letter-spacing:-.04em}.metric-card span{font-size:.8rem;color:var(--muted)}
.section{padding:4.5rem 1.5rem}.wrap{max-width:1180px;margin:0 auto}.section-head{max-width:620px;margin-bottom:2.5rem}.section-head h2{font-size:clamp(1.8rem,3vw,2.7rem);letter-spacing:-.035em;line-height:1.1;margin-bottom:.7rem}.section-head p{color:var(--muted)}
.services{display:grid;grid-template-columns:repeat(3,1fr);gap:1rem}.service{background:var(--surface);border:1px solid var(--line);border-radius:var(--r-lg);padding:1.4rem}.service img{width:100%;aspect-ratio:16/10;object-fit:cover;border-radius:var(--r);margin-bottom:1rem}.service h3{font-size:1rem;margin-bottom:.45rem}.service p{font-size:.9rem;color:var(--muted)}
.band{background:var(--soft)}.doctors{display:grid;grid-template-columns:repeat(3,1fr);gap:1rem}.doctor{background:#fff;border:1px solid var(--line);border-radius:var(--r-lg);overflow:hidden}.doctor img{width:100%;aspect-ratio:4/3;object-fit:cover}.doctor div{padding:1rem}.doctor p{font-size:.82rem;color:var(--muted)}
.booking{display:grid;grid-template-columns:.9fr 1.1fr;gap:2rem;align-items:start}.proof{display:grid;grid-template-columns:repeat(2,1fr);gap:.8rem;margin-top:1.5rem}.proof div{background:var(--soft);border:1px solid var(--line);border-radius:var(--r);padding:1rem}.proof strong{display:block;font-size:1.4rem}.proof span{font-size:.78rem;color:var(--muted)}
.form{background:#fff;border:1px solid var(--line);border-radius:var(--r-xl);padding:1.5rem;box-shadow:0 18px 50px rgba(16,33,29,.08)}.grid2{display:grid;grid-template-columns:1fr 1fr;gap:.9rem}.field{margin-bottom:.9rem}.field label{display:block;font-size:.72rem;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);margin-bottom:.4rem}.input,.select,.textarea{width:100%;border:1px solid var(--line);border-radius:var(--r);padding:.78rem .85rem;background:#fbfdfc;font:inherit}.textarea{height:108px;resize:vertical}.submit{width:100%;padding:.9rem 1rem;border-radius:var(--r);background:var(--accent);color:#fff;font-weight:800}.success{padding:3rem 1rem;text-align:center}.success h3{font-size:1.35rem;margin-bottom:.4rem}.success p{color:var(--muted)}
.footer{padding:2rem 1.5rem;border-top:1px solid var(--line);color:var(--muted);font-size:.85rem}.footer div{max-width:1180px;margin:0 auto;display:flex;justify-content:space-between;gap:1rem}
@media(max-width:900px){.hero,.booking{grid-template-columns:1fr}.services,.doctors{grid-template-columns:1fr}.hero-media{order:-1}.nav-links{display:none}}
@media(max-width:640px){.grid2,.proof{grid-template-columns:1fr}.hero{padding-top:2rem}.metric-card{position:static;margin-top:1rem}}`,
      },
      {
        path: 'src/App.tsx',
        language: 'tsx',
        code: `import { useState } from 'react'
import './styles/theme.css'

const services = [
  { title: 'Primary care', text: 'Preventive visits, diagnostics, and long-term health planning.', image: 'https://images.unsplash.com/photo-1579684385127-1ef15d508118?w=900&q=80&auto=format&fit=crop' },
  { title: 'Nutrition therapy', text: 'Evidence-based nutrition plans shaped around your habits and goals.', image: 'https://images.unsplash.com/photo-1490645935967-10de6ba17061?w=900&q=80&auto=format&fit=crop' },
  { title: 'Mind-body care', text: 'Stress management, sleep coaching, and restorative wellness programs.', image: 'https://images.unsplash.com/photo-1506126613408-eca07ce68773?w=900&q=80&auto=format&fit=crop' },
]

const doctors = [
  { name: 'Dr. Elise Morgan', role: 'Family medicine', image: 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=800&q=80&auto=format&fit=crop' },
  { name: 'Nadia Patel, RD', role: 'Clinical nutrition', image: 'https://images.unsplash.com/photo-1594824476967-48c8b964273f?w=800&q=80&auto=format&fit=crop' },
  { name: 'Dr. Leo Hart', role: 'Integrative care', image: 'https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=800&q=80&auto=format&fit=crop' },
]

export default function App() {
  const [sent, setSent] = useState(false)
  return (
    <div>
      <header className="nav">
        <div className="nav-inner">
          <a className="brand" href="#">Luma<span>Care</span></a>
          <nav className="nav-links">
            <a href="#services">Services</a><a href="#team">Team</a><a href="#booking">Booking</a>
          </nav>
          <a className="nav-cta" href="#booking">Book a visit</a>
        </div>
      </header>
      <main>
        <section className="hero">
          <div>
            <p className="eyebrow">Modern wellness clinic</p>
            <h1>Whole-person care for your everyday health.</h1>
            <p>Primary care, nutrition, and restorative wellness in one calm, coordinated experience.</p>
            <div className="actions"><a className="btn-primary" href="#booking">Request appointment</a><a className="btn-secondary" href="#services">Explore services</a></div>
          </div>
          <div className="hero-media">
            <img src="https://images.unsplash.com/photo-1505751172876-fa1923c5c528?w=1100&q=80&auto=format&fit=crop" alt="Clinician consulting with patient" />
            <div className="metric-card"><strong>4.9/5</strong><span>Average patient rating</span></div>
          </div>
        </section>
        <section className="section" id="services">
          <div className="wrap">
            <div className="section-head"><p className="eyebrow">Services</p><h2>Care plans designed around real life.</h2><p>Choose a single visit or build a guided program with our clinical team.</p></div>
            <div className="services">{services.map(s => <article className="service" key={s.title}><img src={s.image} alt={s.title} /><h3>{s.title}</h3><p>{s.text}</p></article>)}</div>
          </div>
        </section>
        <section className="section band" id="team">
          <div className="wrap">
            <div className="section-head"><p className="eyebrow">Practitioners</p><h2>Specialists who listen first.</h2><p>Meet the clinicians guiding LumaCare's integrated approach.</p></div>
            <div className="doctors">{doctors.map(d => <article className="doctor" key={d.name}><img src={d.image} alt={d.name} /><div><h3>{d.name}</h3><p>{d.role}</p></div></article>)}</div>
          </div>
        </section>
        <section className="section" id="booking">
          <div className="wrap booking">
            <div><p className="eyebrow">Appointments</p><h2>Start with a 20-minute consult.</h2><p style={{ color: 'var(--muted)' }}>Tell us what you need and our care coordinator will match you with the right practitioner.</p><div className="proof"><div><strong>24h</strong><span>Response time</span></div><div><strong>8k+</strong><span>Patients served</span></div></div></div>
            <form className="form" onSubmit={e => { e.preventDefault(); setSent(true) }}>
              {sent ? <div className="success"><h3>Request received</h3><p>We will contact you within one business day.</p></div> : <>
                <div className="grid2"><div className="field"><label htmlFor="name">Name</label><input id="name" className="input" required /></div><div className="field"><label htmlFor="email">Email</label><input id="email" type="email" className="input" required /></div></div>
                <div className="grid2"><div className="field"><label htmlFor="service">Service</label><select id="service" className="select"><option>Primary care</option><option>Nutrition therapy</option><option>Mind-body care</option></select></div><div className="field"><label htmlFor="time">Preferred time</label><select id="time" className="select"><option>Morning</option><option>Afternoon</option><option>Evening</option></select></div></div>
                <div className="field"><label htmlFor="message">What brings you in?</label><textarea id="message" className="textarea" /></div><button className="submit" type="submit">Send request</button>
              </>}
            </form>
          </div>
        </section>
      </main>
      <footer className="footer"><div><span>LumaCare Clinic</span><span>Insurance-friendly care in Austin, TX</span></div></footer>
    </div>
  )
}`,
      },
    ],
  }
}

// Template 8: Real Estate Agency
function realEstateAgency(): Template {
  return {
    id: 'real-estate-agency',
    name: 'Real Estate Agency',
    description: 'A premium property website for boutique real estate teams and luxury listings.',
    category: 'Portfolio',
    accentColor: '#b45309',
    highlights: [
      'Luxury property hero with editorial layout',
      'Featured listings with real home photography',
      'Agent profile, market stats, and inquiry form',
      'Responsive design for listing discovery',
    ],
    files: [
      {
        path: 'src/styles/theme.css',
        language: 'css',
        code: `*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
html{scroll-behavior:smooth}body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',system-ui,sans-serif;background:#fbfaf7;color:#191612;line-height:1.6;overflow-x:hidden}a{color:inherit;text-decoration:none}button{font:inherit}
:root{--bg:#fbfaf7;--paper:#fff;--ink:#191612;--muted:#746b5f;--line:#e8e0d5;--accent:#b45309;--dark:#211a12;--r:8px;--r-lg:14px;--r-xl:20px}
.nav{position:sticky;top:0;background:rgba(251,250,247,.93);backdrop-filter:blur(16px);border-bottom:1px solid var(--line);z-index:10}.nav-inner{max-width:1220px;margin:0 auto;height:70px;padding:0 1.5rem;display:flex;align-items:center;justify-content:space-between}.brand{font-weight:900;letter-spacing:-.03em}.links{display:flex;gap:1rem}.links a{font-size:.88rem;color:var(--muted)}.links a:hover{color:var(--ink)}.nav-btn{padding:.65rem 1rem;background:var(--dark);color:#fff;border-radius:var(--r);font-weight:750;font-size:.88rem}
.hero{max-width:1220px;margin:0 auto;padding:4rem 1.5rem 3rem;display:grid;grid-template-columns:.88fr 1.12fr;gap:3rem;align-items:end}.label{font-size:.72rem;font-weight:850;letter-spacing:.16em;text-transform:uppercase;color:var(--accent);margin-bottom:1rem}.hero h1{font-size:clamp(2.8rem,5vw,5rem);line-height:.98;letter-spacing:-.055em;margin-bottom:1.2rem}.hero p{color:var(--muted);max-width:520px;margin-bottom:1.6rem}.search{background:#fff;border:1px solid var(--line);border-radius:var(--r-lg);padding:.7rem;display:grid;grid-template-columns:1fr 1fr auto;gap:.6rem;box-shadow:0 20px 60px rgba(33,26,18,.1)}.search input,.search select{border:1px solid var(--line);border-radius:var(--r);padding:.75rem;background:#fbfaf7;font:inherit}.search button{border:0;border-radius:var(--r);background:var(--accent);color:#fff;padding:0 1rem;font-weight:800}.hero-img{position:relative}.hero-img img{width:100%;aspect-ratio:5/4;object-fit:cover;border-radius:var(--r-xl);box-shadow:0 28px 80px rgba(33,26,18,.18)}.floating{position:absolute;right:1.2rem;bottom:1.2rem;background:#fff;border-radius:var(--r-lg);padding:1rem 1.2rem;box-shadow:0 20px 50px rgba(33,26,18,.18)}.floating strong{display:block;font-size:1.4rem}.floating span{font-size:.8rem;color:var(--muted)}
.section{padding:4.5rem 1.5rem}.wrap{max-width:1220px;margin:0 auto}.head{display:flex;justify-content:space-between;gap:2rem;align-items:end;margin-bottom:2rem}.head h2{font-size:clamp(1.8rem,3vw,2.8rem);letter-spacing:-.04em;line-height:1.05}.head p{max-width:420px;color:var(--muted)}.listings{display:grid;grid-template-columns:repeat(3,1fr);gap:1rem}.card{background:#fff;border:1px solid var(--line);border-radius:var(--r-lg);overflow:hidden;transition:transform .2s,box-shadow .2s}.card:hover{transform:translateY(-4px);box-shadow:0 18px 50px rgba(33,26,18,.12)}.card img{width:100%;aspect-ratio:4/3;object-fit:cover}.card-body{padding:1rem}.price{font-size:1.25rem;font-weight:900;letter-spacing:-.03em}.addr{color:var(--muted);font-size:.88rem;margin:.2rem 0 .8rem}.facts{display:flex;gap:.8rem;color:var(--muted);font-size:.78rem;border-top:1px solid var(--line);padding-top:.8rem}
.dark{background:var(--dark);color:#fff}.dark .wrap{display:grid;grid-template-columns:.9fr 1.1fr;gap:3rem;align-items:center}.agent{display:grid;grid-template-columns:160px 1fr;gap:1.4rem;align-items:center}.agent img{width:160px;height:190px;object-fit:cover;border-radius:var(--r-lg)}.agent p{color:#cbbfaa}.stats{display:grid;grid-template-columns:repeat(3,1fr);gap:.8rem}.stat{border:1px solid rgba(255,255,255,.16);border-radius:var(--r-lg);padding:1.1rem}.stat strong{display:block;font-size:1.6rem}.stat span{color:#cbbfaa;font-size:.82rem}
.contact{display:grid;grid-template-columns:.9fr 1.1fr;gap:2rem}.form{background:#fff;border:1px solid var(--line);border-radius:var(--r-xl);padding:1.4rem}.grid2{display:grid;grid-template-columns:1fr 1fr;gap:.8rem}.field{margin-bottom:.8rem}.field label{display:block;font-size:.72rem;font-weight:850;text-transform:uppercase;letter-spacing:.08em;color:var(--muted);margin-bottom:.35rem}.field input,.field textarea{width:100%;border:1px solid var(--line);border-radius:var(--r);padding:.8rem;font:inherit;background:#fbfaf7}.field textarea{height:112px;resize:vertical}.submit{width:100%;border:0;border-radius:var(--r);background:var(--dark);color:#fff;padding:.9rem;font-weight:850}.ok{text-align:center;padding:2.5rem;color:var(--muted)}
.footer{padding:2rem 1.5rem;border-top:1px solid var(--line);color:var(--muted);font-size:.85rem}.footer div{max-width:1220px;margin:0 auto;display:flex;justify-content:space-between}
@media(max-width:900px){.hero,.dark .wrap,.contact{grid-template-columns:1fr}.listings{grid-template-columns:1fr}.links{display:none}.search{grid-template-columns:1fr}.agent{grid-template-columns:1fr}.stats{grid-template-columns:1fr 1fr}}
@media(max-width:640px){.head{display:block}.grid2{grid-template-columns:1fr}.stats{grid-template-columns:1fr}}`,
      },
      {
        path: 'src/App.tsx',
        language: 'tsx',
        code: `import { useState } from 'react'
import './styles/theme.css'

const listings = [
  { price: '$2.85M', title: 'Canyon Ridge Residence', address: '824 Laurel Canyon, Los Angeles', facts: ['4 beds', '4.5 baths', '4,180 sqft'], image: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1000&q=80&auto=format&fit=crop' },
  { price: '$1.92M', title: 'Marina Glass House', address: '221 Harbor View, Newport Beach', facts: ['3 beds', '3 baths', '2,740 sqft'], image: 'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=1000&q=80&auto=format&fit=crop' },
  { price: '$3.40M', title: 'Oakline Estate', address: '66 Ridge Road, Montecito', facts: ['5 beds', '6 baths', '5,020 sqft'], image: 'https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?w=1000&q=80&auto=format&fit=crop' },
]

export default function App() {
  const [sent, setSent] = useState(false)
  return (
    <div>
      <header className="nav"><div className="nav-inner"><a className="brand" href="#">Northline Estates</a><nav className="links"><a href="#listings">Listings</a><a href="#agent">Agent</a><a href="#contact">Contact</a></nav><a className="nav-btn" href="#contact">Private consult</a></div></header>
      <main>
        <section className="hero">
          <div><p className="label">Boutique property advisory</p><h1>Distinctive homes, represented with precision.</h1><p>Luxury residential brokerage for buyers and sellers who expect strategic pricing, editorial presentation, and discreet negotiation.</p><form className="search"><input aria-label="Location" placeholder="City or neighborhood" /><select aria-label="Budget"><option>$1M - $2M</option><option>$2M - $4M</option><option>$4M+</option></select><button type="button">Search</button></form></div>
          <div className="hero-img"><img src="https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?w=1200&q=80&auto=format&fit=crop" alt="Luxury living room" /><div className="floating"><strong>$840M+</strong><span>Closed volume</span></div></div>
        </section>
        <section className="section" id="listings"><div className="wrap"><div className="head"><div><p className="label">Featured listings</p><h2>Homes with rare presence.</h2></div><p>Every listing receives a tailored campaign across photography, private buyer networks, and targeted digital distribution.</p></div><div className="listings">{listings.map(item => <article className="card" key={item.title}><img src={item.image} alt={item.title} /><div className="card-body"><p className="price">{item.price}</p><h3>{item.title}</h3><p className="addr">{item.address}</p><div className="facts">{item.facts.map(f => <span key={f}>{f}</span>)}</div></div></article>)}</div></div></section>
        <section className="section dark" id="agent"><div className="wrap"><div className="agent"><img src="https://images.unsplash.com/photo-1560250097-0b93528c311a?w=700&q=80&auto=format&fit=crop" alt="Julian Price" /><div><p className="label">Lead advisor</p><h2>Julian Price</h2><p>Twenty years representing architecturally significant homes across coastal California.</p></div></div><div className="stats"><div className="stat"><strong>98%</strong><span>List-to-sale ratio</span></div><div className="stat"><strong>31</strong><span>Days median market time</span></div><div className="stat"><strong>420+</strong><span>Private clients served</span></div></div></div></section>
        <section className="section" id="contact"><div className="wrap contact"><div><p className="label">Inquiry</p><h2>Plan your next move with a clear market view.</h2><p style={{ color: 'var(--muted)' }}>Request a confidential valuation, buyer brief, or listing strategy consultation.</p></div><form className="form" onSubmit={e => { e.preventDefault(); setSent(true) }}>{sent ? <div className="ok">Thank you. Our team will follow up shortly.</div> : <><div className="grid2"><div className="field"><label htmlFor="n">Name</label><input id="n" required /></div><div className="field"><label htmlFor="e">Email</label><input id="e" type="email" required /></div></div><div className="field"><label htmlFor="m">Message</label><textarea id="m" placeholder="Tell us what you are looking for." /></div><button className="submit">Send inquiry</button></>}</form></div></section>
      </main>
      <footer className="footer"><div><span>Northline Estates</span><span>Los Angeles - Newport Beach - Montecito</span></div></footer>
    </div>
  )
}`,
      },
    ],
  }
}

// Template 9: Conference Event
function conferenceEvent(): Template {
  return {
    id: 'conference-event',
    name: 'Conference Event',
    description: 'A sharp event website for conferences, summits, and launch gatherings.',
    category: 'Blog',
    accentColor: '#dc2626',
    highlights: [
      'High-impact hero with real audience photography',
      'Schedule tabs, speaker cards, and ticket tiers',
      'Sponsor-ready layout with strong conversion CTA',
      'Responsive event landing page structure',
    ],
    files: [
      {
        path: 'src/styles/theme.css',
        language: 'css',
        code: `*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
html{scroll-behavior:smooth}body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',system-ui,sans-serif;background:#09090b;color:#f7f7f8;line-height:1.6;overflow-x:hidden}a{color:inherit;text-decoration:none}button{font:inherit;color:inherit;border:0;cursor:pointer}
:root{--bg:#09090b;--panel:#121216;--panel-2:#1d1d24;--text:#f7f7f8;--muted:#a1a1aa;--line:rgba(255,255,255,.1);--accent:#dc2626;--accent-2:#f59e0b;--r:8px;--r-lg:14px;--r-xl:20px}
.nav{position:fixed;top:0;left:0;right:0;z-index:30;background:rgba(9,9,11,.78);backdrop-filter:blur(18px);border-bottom:1px solid var(--line)}.nav-inner{max-width:1180px;margin:0 auto;height:66px;padding:0 1.5rem;display:flex;align-items:center;justify-content:space-between}.brand{font-weight:950;letter-spacing:-.03em}.brand span{color:var(--accent)}.links{display:flex;gap:1rem}.links a{font-size:.86rem;color:var(--muted)}.links a:hover{color:#fff}.nav-btn{background:#fff;color:#09090b;border-radius:var(--r);padding:.65rem 1rem;font-weight:850;font-size:.86rem}
.hero{position:relative;min-height:92vh;display:grid;place-items:end center;padding:8rem 1.5rem 4rem;overflow:hidden}.hero img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:.42}.hero::after{content:'';position:absolute;inset:0;background:linear-gradient(to bottom,rgba(9,9,11,.2),#09090b 88%)}.hero-inner{position:relative;z-index:1;max-width:1180px;width:100%;display:grid;grid-template-columns:1fr .55fr;gap:3rem;align-items:end}.kicker{font-size:.72rem;font-weight:900;letter-spacing:.18em;text-transform:uppercase;color:var(--accent-2);margin-bottom:1rem}.hero h1{font-size:clamp(3rem,7vw,6.5rem);line-height:.9;letter-spacing:-.065em;margin-bottom:1.2rem}.hero p{max-width:620px;color:#d4d4d8;font-size:1.08rem}.event-card{background:rgba(18,18,22,.82);border:1px solid var(--line);border-radius:var(--r-xl);padding:1.3rem;box-shadow:0 28px 80px rgba(0,0,0,.35)}.event-row{display:flex;justify-content:space-between;border-bottom:1px solid var(--line);padding:.8rem 0;color:var(--muted)}.event-row strong{color:#fff}.cta{display:block;margin-top:1rem;text-align:center;background:var(--accent);border-radius:var(--r);padding:.9rem 1rem;font-weight:900}
.section{padding:4.5rem 1.5rem}.wrap{max-width:1180px;margin:0 auto}.head{max-width:680px;margin-bottom:2rem}.head h2{font-size:clamp(2rem,4vw,3.5rem);line-height:1;letter-spacing:-.055em;margin-bottom:.8rem}.head p{color:var(--muted)}.speakers{display:grid;grid-template-columns:repeat(4,1fr);gap:1rem}.speaker{background:var(--panel);border:1px solid var(--line);border-radius:var(--r-lg);overflow:hidden}.speaker img{width:100%;aspect-ratio:1;object-fit:cover}.speaker div{padding:1rem}.speaker p{color:var(--muted);font-size:.84rem}
.schedule{background:var(--panel)}.days{display:flex;gap:.6rem;margin-bottom:1.4rem;flex-wrap:wrap}.day{background:var(--panel-2);border:1px solid var(--line);border-radius:999px;padding:.55rem 1rem;color:var(--muted)}.day.active{background:var(--accent);color:#fff;border-color:var(--accent)}.agenda{display:grid;gap:.8rem}.slot{display:grid;grid-template-columns:120px 1fr auto;gap:1rem;align-items:center;background:#09090b;border:1px solid var(--line);border-radius:var(--r-lg);padding:1rem}.time{font-weight:900;color:var(--accent-2)}.slot p{color:var(--muted);font-size:.88rem}.badge{font-size:.72rem;text-transform:uppercase;letter-spacing:.08em;color:#fff;background:var(--panel-2);padding:.3rem .6rem;border-radius:999px}
.tickets{display:grid;grid-template-columns:repeat(3,1fr);gap:1rem}.ticket{background:var(--panel);border:1px solid var(--line);border-radius:var(--r-xl);padding:1.4rem}.ticket.featured{border-color:var(--accent);box-shadow:0 0 0 4px rgba(220,38,38,.15)}.ticket h3{font-size:1rem;text-transform:uppercase;letter-spacing:.1em}.price{font-size:2.6rem;font-weight:950;letter-spacing:-.05em;margin:.6rem 0}.ticket ul{list-style:none;display:grid;gap:.5rem;color:var(--muted);font-size:.9rem}.ticket a{display:block;margin-top:1.3rem;text-align:center;padding:.85rem;border-radius:var(--r);background:#fff;color:#09090b;font-weight:900}.ticket.featured a{background:var(--accent);color:#fff}
.footer-cta{padding:4.5rem 1.5rem;background:#fff;color:#09090b}.footer-cta .wrap{display:flex;align-items:center;justify-content:space-between;gap:2rem}.footer-cta h2{font-size:clamp(2rem,4vw,3.4rem);letter-spacing:-.055em;line-height:1}.footer-cta a{background:#09090b;color:#fff;border-radius:var(--r);padding:.9rem 1.1rem;font-weight:900}.footer{padding:2rem 1.5rem;color:var(--muted);font-size:.85rem}.footer div{max-width:1180px;margin:0 auto;display:flex;justify-content:space-between}
@media(max-width:980px){.hero-inner{grid-template-columns:1fr}.speakers,.tickets{grid-template-columns:1fr 1fr}.links{display:none}.slot{grid-template-columns:1fr}.footer-cta .wrap{display:block}.footer-cta a{display:inline-block;margin-top:1rem}}
@media(max-width:640px){.speakers,.tickets{grid-template-columns:1fr}.hero{min-height:760px}.event-card{width:100%}}`,
      },
      {
        path: 'src/App.tsx',
        language: 'tsx',
        code: `import { useState } from 'react'
import './styles/theme.css'

const speakers = [
  { name: 'Mina Torres', role: 'Founder, Signal Labs', img: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=700&q=80&auto=format&fit=crop' },
  { name: 'Caleb Stone', role: 'Design Director, Northstar', img: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=700&q=80&auto=format&fit=crop' },
  { name: 'Aisha Reed', role: 'AI Product Lead, Vertex', img: 'https://images.unsplash.com/photo-1531123897727-8f129e1688ce?w=700&q=80&auto=format&fit=crop' },
  { name: 'Jon Bell', role: 'CTO, Atlas Cloud', img: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=700&q=80&auto=format&fit=crop' },
]

const agenda = [
  { time: '09:30', title: 'Opening keynote: building products at AI speed', type: 'Keynote' },
  { time: '11:00', title: 'Designing trustworthy automation for real users', type: 'Design' },
  { time: '13:30', title: 'Scaling teams when roadmaps change weekly', type: 'Ops' },
  { time: '15:00', title: 'Live product teardown with the speaker panel', type: 'Panel' },
]

export default function App() {
  const [day, setDay] = useState('Day 1')
  return (
    <div>
      <header className="nav"><div className="nav-inner"><a className="brand" href="#">Future<span>Stack</span></a><nav className="links"><a href="#speakers">Speakers</a><a href="#schedule">Schedule</a><a href="#tickets">Tickets</a></nav><a className="nav-btn" href="#tickets">Get tickets</a></div></header>
      <main>
        <section className="hero">
          <img src="https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=1800&q=80&auto=format&fit=crop" alt="Conference audience" />
          <div className="hero-inner">
            <div><p className="kicker">San Francisco - October 18-19</p><h1>The product conference for teams shipping tomorrow.</h1><p>Two days of strategy, systems, and honest conversations with the builders turning AI from demos into durable businesses.</p></div>
            <aside className="event-card"><div className="event-row"><span>Date</span><strong>Oct 18-19</strong></div><div className="event-row"><span>Venue</span><strong>Fort Mason Center</strong></div><div className="event-row"><span>Speakers</span><strong>36 leaders</strong></div><a className="cta" href="#tickets">Reserve seat</a></aside>
          </div>
        </section>
        <section className="section" id="speakers"><div className="wrap"><div className="head"><p className="kicker">Featured speakers</p><h2>Practitioners with receipts.</h2><p>Operators, designers, engineers, and founders sharing what is working now.</p></div><div className="speakers">{speakers.map(s => <article className="speaker" key={s.name}><img src={s.img} alt={s.name} /><div><h3>{s.name}</h3><p>{s.role}</p></div></article>)}</div></div></section>
        <section className="section schedule" id="schedule"><div className="wrap"><div className="head"><p className="kicker">Schedule</p><h2>Two focused days. Zero filler.</h2></div><div className="days">{['Day 1','Day 2','Workshops'].map(d => <button className={\`day\${day === d ? ' active' : ''}\`} onClick={() => setDay(d)} type="button" key={d}>{d}</button>)}</div><div className="agenda">{agenda.map(a => <article className="slot" key={a.time}><span className="time">{a.time}</span><div><h3>{a.title}</h3><p>{day} - Main stage</p></div><span className="badge">{a.type}</span></article>)}</div></div></section>
        <section className="section" id="tickets"><div className="wrap"><div className="head"><p className="kicker">Tickets</p><h2>Choose your pass.</h2><p>All passes include recordings, breakfast, lunch, and evening networking.</p></div><div className="tickets">{[{name:'Starter',price:'$249',items:['Main stage access','Session recordings','Community Slack']},{name:'Pro',price:'$549',items:['Everything in Starter','Workshop access','Speaker dinner'],featured:true},{name:'Team',price:'$1,499',items:['5 Pro passes','Reserved seating','Private team room']}].map(t => <article className={\`ticket\${t.featured ? ' featured' : ''}\`} key={t.name}><h3>{t.name}</h3><p className="price">{t.price}</p><ul>{t.items.map(i => <li key={i}>{i}</li>)}</ul><a href="#">Buy pass</a></article>)}</div></div></section>
        <section className="footer-cta"><div className="wrap"><h2>Bring your team to the room where product changes next.</h2><a href="#tickets">Get tickets</a></div></section>
      </main>
      <footer className="footer"><div><span>FutureStack 2026</span><span>San Francisco, CA</span></div></footer>
    </div>
  )
}`,
      },
    ],
  }
}
