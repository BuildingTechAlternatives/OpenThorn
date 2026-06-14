# Agent Skill Loading — Design Spec
_2026-06-15_

## Summary

Replace the keyword-triggered skill auto-injection system with a model-driven `load_skill` tool. The agent sees a compact catalog (id + description) and decides itself when to load a skill.

## Architecture

### New Tool: `load_skill`

Added to `AGENT_TOOLS` in `agent-prompt.ts`:

```ts
{
  name: 'load_skill',
  description: 'Load a skill to get deep domain knowledge before working on tasks in that domain.',
  input_schema: {
    type: 'object',
    properties: {
      skill_id: {
        type: 'string',
        enum: ['ui-ux-pro-max', 'frontend-design', 'react-best-practices', 'motion-dev-animations', 'performance', 'core-web-vitals'],
      }
    },
    required: ['skill_id'],
    additionalProperties: false
  }
}
```

The tool result is the full skill body text. No extra state, no extra round-trip.

### System Prompt Skill Catalog

Added to the system prompt (byte-identical, cache-safe):

```
## Available Skills

Call load_skill(skill_id) before working on tasks in these domains:

- ui-ux-pro-max          → Design intelligence: palettes, UX rules, responsive, accessibility patterns
- frontend-design        → Distinctive interfaces with bold aesthetic direction; avoids generic AI aesthetics
- react-best-practices   → React 19 hooks, effects, composition, component patterns
- motion-dev-animations  → Motion.dev (Framer Motion successor): 120fps animations, scroll, gestures
- performance            → Loading speed, code splitting, image optimization, caching
- core-web-vitals        → LCP, INP, CLS — specific fixes, checklists, framework patterns
```

### Removed

- `triggers` field from `SkillBlock` interface
- `resolveActiveSkills()` function
- Auto-injection of skills before first turn in `agent.ts`
- All 5 old skills: routing, accessibility, animation, canvas-game, forms

## Skills

| ID | Source | Size | Notes |
|---|---|---|---|
| `ui-ux-pro-max` | nextlevelbuilder/GitHub | ~7KB trimmed | Sections §1,§2(web-only),§4-§9; no Python workflows, no §3 Perf, no §10 Charts |
| `frontend-design` | Official Claude plugin | ~1.5KB | Full content |
| `react-best-practices` | 0xbigboss/GitHub | ~1.5KB | Full content |
| `motion-dev-animations` | 199-biotechnologies/GitHub | ~7KB | Full content |
| `performance` | addyosmani/GitHub | ~8KB | Full content |
| `core-web-vitals` | addyosmani/GitHub | ~8KB | Full content |

## Files Changed

- `src/lib/agent-prompt.ts` — new tool, new SKILL_BLOCKS (no triggers), new system prompt section, trimmed ui-ux-pro-max content
- `src/lib/agent.ts` — remove `resolveActiveSkills` call + injection; add `load_skill` handler in tool execution
