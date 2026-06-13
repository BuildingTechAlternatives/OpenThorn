# r/SideProject Post — OpenThorn

## Title

I got tired of AI website builders charging $30/month to resell API access, so I built one where you bring your own key

(Alternative, shorter: "I built an AI website builder with no subscription — you plug in your own API key and pay the provider directly")

## Body

Every AI website builder I tried had the same model: $25–50/month for "credits" that are really just OpenAI/Anthropic API calls resold at a markup. You don't pick the model, you can't export the code without paying more, and when the credits run out mid-project you're stuck.

So I spent the last months building OpenThorn. The idea is simple: the platform is free, you connect your own API key (OpenAI, Anthropic, Gemini, DeepSeek, Groq, Ollama, OpenRouter — 18 providers total), and you pay your provider's raw per-token rates. A typical small site costs cents, not a subscription.

How it works: you describe the site, an agent writes the code, and the preview renders **live in your browser** — I bundle everything client-side with esbuild-wasm, so there's no server build step and no waiting. When you're happy, it deploys to a public URL in one click, or you just export the full source. No proprietary format, no paywall on your own code.

The hardest parts to get right:

- **The agent loop.** Making 17 different providers behave like one reliable agent meant building retry with backoff, a circuit breaker, and mid-run failover — if your provider rate-limits you halfway through, the agent switches and keeps going instead of dying.
- **Trusting nothing.** The agent has to pass a verification gate before it's allowed to say "done": the code must compile, the plan must be complete, and an automated smoke test clicks through the preview.
- **Key security.** Your API key is encrypted server-side (AES-256-GCM, per-user derived keys) and the raw key never touches the client.

Stack: React 19 + TypeScript + Vite, Supabase (auth/Postgres/realtime), esbuild-wasm in the browser, Vercel for the API, Netlify for the generated sites.

It's live at https://openthorn.app — free to use, no credit card, you just need an API key from any provider (or run Ollama locally and pay nothing at all).

Honest question for the builders here: is BYOK something you'd actually want, or do most people prefer the convenience of credits even at a markup? And if you try it, I'd genuinely love to know where it breaks — the agent handles most prompts well but I'm sure this sub can find the edges.

## Media: use a video, not an image

Record a **30–45 second single-take screen capture** of the real product:

1. **0–5s:** Type a concrete, slightly fun prompt ("a booking site for a dog grooming salon, warm colors") and hit go. Start right at the typing — no logo intro, no landing page tour.
2. **5–25s:** The agent working — files appearing, plan checklist ticking off, the live preview building itself. Speed up (2–4x) any waiting; dead air kills retention.
3. **25–35s:** Click around the finished preview to show it's a real interactive site, then hit deploy and show the live Netlify URL loading in a new tab.
4. **Last 3–5s:** One text overlay: **"Free platform. Your API key. ~$0.10 for this site."** The real cost number is the most differentiating frame.

Practical notes:

- Reddit video is mostly watched muted and inline → use text overlays, not narration. No background music.
- Keep it under 60 seconds, standard desktop resolution.
- Fallback if no video: a single before/after image — prompt on the left, finished deployed site on the right, with the cost overlay. Expect less traction.

## Posting tips

- Trim the body if it reads longer than ~45 seconds.
- Keep the two questions at the end — they turn the post from an ad into a discussion, and comments drive ranking.
- Spend 20–30 minutes genuinely commenting on other posts before and after publishing; the sub is actively hostile to drive-by promoters right now.
