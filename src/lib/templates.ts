import type { AgentCodeFile } from './agent'

export interface Template {
  id: string
  name: string
  description: string
  category: 'Portfolio' | 'SaaS' | 'E-commerce'
  highlights: string[]
  accentColor: string
  files: AgentCodeFile[]
}

export const TEMPLATES: Template[] = [
  creativePortfolio(),
  saasLanding(),
  ecommerceStorefront(),
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
      'Animated gradient orbs in the hero',
      'Filterable project grid with hover effects',
      'Skill groups with animated progress bars',
      'Contact form with social links',
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
          I craft exceptional digital experiences — from pixel-perfect interfaces to scalable backend systems. Turning complex problems into elegant solutions.
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
  { name: 'Phantom Analytics', desc: 'Real-time data platform processing 10M+ events/day with custom WebGL charts.', tags: ['React', 'Node', 'WebGL'], cat: 'Web', icon: '📊', bg: 'linear-gradient(135deg,#1a1a3e,#2d1b69)' },
  { name: 'Orbit Design System', desc: 'Component library with 80+ components used across 5 product teams.', tags: ['Design', 'TypeScript', 'Storybook'], cat: 'Design', icon: '🎨', bg: 'linear-gradient(135deg,#0f2027,#2c5364)' },
  { name: 'FlowCast Mobile', desc: 'Cross-platform podcast app with AI transcription and smart chapter detection.', tags: ['React Native', 'AI', 'Audio'], cat: 'Mobile', icon: '🎙️', bg: 'linear-gradient(135deg,#16213e,#0f3460)' },
  { name: 'NovaPay Gateway', desc: 'High-throughput payment API handling $2M+ daily transactions.', tags: ['Go', 'Stripe', 'Postgres'], cat: 'Web', icon: '💳', bg: 'linear-gradient(135deg,#0d1b2a,#1b4332)' },
  { name: 'Lumina Portfolio', desc: 'Bespoke site for award-winning photographer with immersive gallery.', tags: ['Design', 'GSAP', 'Three.js'], cat: 'Design', icon: '📷', bg: 'linear-gradient(135deg,#1a1a2e,#0f3460)' },
  { name: 'Halo Fitness', desc: 'iOS/Android tracker with AI training plans and progress analytics.', tags: ['React Native', 'ML', 'HealthKit'], cat: 'Mobile', icon: '🏋️', bg: 'linear-gradient(135deg,#1c0a00,#4a1503)' },
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
          <h2 className="section-heading">Projects I'm proud of</h2>
          <p className="section-sub">Hand-picked projects spanning web apps, design systems, and mobile.</p>
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
                <span className="project-thumb-icon">{p.icon}</span>
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
    description: 'A clean, high-converting landing page for a SaaS product.',
    category: 'SaaS',
    accentColor: '#2563eb',
    highlights: [
      'Bold hero with animated product mockup',
      'Feature grid, testimonials, and pricing tiers',
      'FAQ accordion with smooth expand/collapse',
      'Full-width gradient CTA section',
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
.t-avatar{width:36px;height:36px;border-radius:50%;display:grid;place-items:center;font-size:.875rem;font-weight:700;color:#fff;flex-shrink:0}
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
  { text: 'Synapse replaced 3 different tools. Our team spends 80% less time on reporting and AI insights drove a 23% revenue increase.', name: 'Sarah Chen', role: 'VP of Growth, Meridian', color: '#7c3aed' },
  { text: 'I cancelled our Mixpanel subscription within a week. The UX is just on a different level.', name: 'Marcus Williams', role: 'Head of Product, Stackwell', color: '#0d9488' },
  { text: 'The real-time alerts saved us from a major churn event. We caught a drop 48 hours before it became a real problem.', name: 'Priya Patel', role: 'CEO, Loopback AI', color: '#d97706' },
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
                <div className="t-avatar" style={{ background: t.color }}>{t.name[0]}</div>
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
      'Editorial hero with featured product',
      'Product grid with hover quick-add',
      'Slide-in cart drawer with line items',
      'Category navigation and sticky header',
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
.nav-icon-btn{width:40px;height:40px;display:grid;place-items:center;border-radius:var(--r);transition:background .15s;font-size:1.1rem;position:relative}
.nav-icon-btn:hover{background:var(--bg-2)}
.cart-badge{position:absolute;top:4px;right:4px;width:16px;height:16px;background:var(--accent);color:#fff;border-radius:50%;font-size:.6rem;font-weight:700;display:grid;place-items:center}

.hero{display:grid;grid-template-columns:1fr 1fr;min-height:88vh;max-width:1300px;margin:0 auto;padding:0 2rem;gap:4rem;align-items:center}
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
.hero-product-img{width:100%;aspect-ratio:3/4;border-radius:var(--r-xl);overflow:hidden;background:var(--bg-2);display:flex;align-items:center;justify-content:center}
.hero-product-emoji{font-size:8rem;filter:drop-shadow(0 20px 40px rgba(0,0,0,.15))}
.hero-badge-float{position:absolute;bottom:2rem;left:-1.5rem;background:#fff;border-radius:var(--r-lg);padding:.875rem 1.25rem;box-shadow:0 8px 24px rgba(0,0,0,.12);display:flex;align-items:center;gap:.75rem}
.hero-badge-icon{font-size:1.5rem}
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
.product-img{aspect-ratio:1;background:var(--bg-2);display:flex;align-items:center;justify-content:center;font-size:4rem;position:relative;overflow:hidden}
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
.cart-item-img{width:72px;height:72px;background:var(--bg-2);border-radius:var(--r);display:grid;place-items:center;font-size:2rem;flex-shrink:0}
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
.cart-empty-icon{font-size:3rem;margin-bottom:1rem}

.site-footer{background:#1a1a1a;color:#e8e3da;padding:3rem 2rem 2rem;margin-top:4rem}
.footer-inner{max-width:1300px;margin:0 auto;display:grid;grid-template-columns:2fr 1fr 1fr 1fr;gap:3rem;margin-bottom:2rem}
.footer-brand{font-size:1.2rem;font-weight:900;letter-spacing:-.02em;margin-bottom:.75rem}
.footer-tagline{font-size:.85rem;color:#9ca3af;line-height:1.6}
.footer-heading{font-size:.7rem;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#6b7280;margin-bottom:.875rem}
.footer-links-list{display:flex;flex-direction:column;gap:.5rem}
.footer-link{font-size:.85rem;color:#9ca3af;transition:color .15s}
.footer-link:hover{color:#e8e3da}
.footer-bottom{border-top:1px solid #2d2d2d;padding-top:1.5rem;max-width:1300px;margin:0 auto;display:flex;justify-content:space-between;align-items:center;font-size:.8rem;color:#6b7280}

@media(max-width:900px){.hero{grid-template-columns:1fr;min-height:auto;padding:3rem 1.5rem}.hero-image-side{order:-1}.footer-inner{grid-template-columns:1fr 1fr}}
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
  icon: string
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
          <span>Made with care for the planet 🌿</span>
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
          <button className="nav-icon-btn" type="button" aria-label="Search">🔍</button>
          <button className="nav-icon-btn" type="button" aria-label="Wishlist">♡</button>
          <button className="nav-icon-btn" type="button" aria-label="Cart" onClick={onCartOpen}>
            🛍️
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
          <button className="btn-add" type="button" onClick={() => onAddToCart({ id: 0, name: 'Linen Shirt — Sage', price: 129, icon: '👕', category: 'Apparel' })}>
            Add to cart
          </button>
          <button className="btn-wishlist" type="button">Save to wishlist</button>
        </div>
      </div>
      <div className="hero-image-side">
        <div className="hero-product-img">
          <span className="hero-product-emoji">🌿</span>
        </div>
        <div className="hero-badge-float">
          <span className="hero-badge-icon">♻️</span>
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
  { id: 1, name: 'Linen Shirt — Sage', price: 129, icon: '👕', category: 'Apparel', rating: '4.9 (124)' },
  { id: 2, name: 'Ceramic Pour-Over Set', price: 89, icon: '☕', category: 'Home & Living', rating: '5.0 (68)' },
  { id: 3, name: 'Canvas Tote Bag', price: 45, icon: '👜', category: 'Accessories', rating: '4.8 (201)' },
  { id: 4, name: 'Rosehip Face Oil', price: 64, icon: '🌹', category: 'Skincare', rating: '4.9 (89)' },
  { id: 5, name: 'Merino Knit Sweater', price: 159, icon: '🧶', category: 'Apparel', rating: '4.7 (55)' },
  { id: 6, name: 'Beeswax Candle Set', price: 38, icon: '🕯️', category: 'Home & Living', rating: '5.0 (143)' },
  { id: 7, name: 'Leather Card Wallet', price: 55, icon: '💳', category: 'Accessories', rating: '4.8 (77)' },
  { id: 8, name: 'Bamboo Body Scrub', price: 29, icon: '🎋', category: 'Skincare', rating: '4.6 (112)' },
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
              {p.icon}
              <button className="product-quick-add" type="button" onClick={() => onAddToCart(p)}>+ Add to cart</button>
            </div>
            <div className="product-body">
              <p className="product-category">{p.category}</p>
              <h3 className="product-name">{p.name}</h3>
              <div className="product-footer">
                <span className="product-price">€{p.price}</span>
                <span className="product-rating">★ {p.rating}</span>
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
            <span className="cart-empty-icon">🛍️</span>
            <p>Your cart is empty</p>
          </div>
        ) : (
          <>
            <div className="cart-items">
              {items.map(item => (
                <div key={item.id} className="cart-item">
                  <div className="cart-item-img">{item.icon}</div>
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
