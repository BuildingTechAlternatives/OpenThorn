// Source: Anthropic official claude-plugins-official/frontend-design
const body = `# Frontend Design — Distinctive Interfaces

This skill guides creation of distinctive, production-grade frontend interfaces that avoid generic "AI slop" aesthetics. Implement real working code with exceptional attention to aesthetic details and creative choices.

## Design Thinking

Before coding, understand the context and commit to a BOLD aesthetic direction:
- **Purpose**: What problem does this interface solve? Who uses it?
- **Tone**: Pick an extreme: brutally minimal, maximalist chaos, retro-futuristic, organic/natural, luxury/refined, playful/toy-like, editorial/magazine, brutalist/raw, art deco/geometric, soft/pastel, industrial/utilitarian.
- **Differentiation**: What makes this UNFORGETTABLE? What is the one thing someone will remember?

**CRITICAL**: Choose a clear conceptual direction and execute it with precision. Bold maximalism and refined minimalism both work — the key is intentionality, not intensity.

## Aesthetic Guidelines

- **Typography**: Choose fonts that are beautiful, unique, and interesting. Avoid generic fonts like Arial, Inter, Roboto, and system fonts. Pair a distinctive display font with a refined body font. Unexpected, characterful font choices.
- **Color & Theme**: Commit to a cohesive aesthetic. Use CSS variables for consistency. Dominant colors with sharp accents outperform timid, evenly-distributed palettes.
- **Motion**: Use animations for effects and micro-interactions. Focus on high-impact moments: one well-orchestrated page load with staggered reveals (animation-delay) creates more delight than scattered micro-interactions. Scroll-triggered reveals and hover states that surprise.
- **Spatial Composition**: Unexpected layouts. Asymmetry. Overlap. Diagonal flow. Grid-breaking elements. Generous negative space OR controlled density — pick one and commit.
- **Backgrounds & Visual Details**: Create atmosphere and depth. Apply: gradient meshes, noise textures, geometric patterns, layered transparencies, dramatic shadows, decorative borders, grain overlays. Never default to plain solid colors.

**NEVER use**: Inter, Roboto, Arial, or system fonts; purple gradients on white backgrounds; predictable card-grid layouts; cookie-cutter component patterns that lack context-specific character.

Vary between light and dark themes, different fonts, different aesthetics across generations. **NEVER** converge on the same choices — each project should feel uniquely designed.

Match implementation complexity to the vision: maximalist designs need elaborate animations and effects; minimalist designs need restraint, precision in spacing, and careful typography. Elegance comes from executing the vision well.

Remember: extraordinary creative work happens when thinking outside the box and committing fully to a distinctive vision.`

export default body
