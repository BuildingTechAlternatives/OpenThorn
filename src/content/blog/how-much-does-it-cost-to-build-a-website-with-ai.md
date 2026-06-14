Building a complete website with AI costs between **$0 and about $3 in API usage** — not the $20–50/month that credit-based builders charge. The exact figure depends on one thing most comparisons skip: how many tokens an agentic build actually consumes, and which model processes them. This post measures that directly.

The number matters because almost every "AI website builder pricing" article quotes subscription tiers, not the underlying cost of the AI work. With a bring-your-own-key (BYOK) tool like [OpenThorn](https://www.openthorn.app), the subscription disappears and you pay only for tokens — so the real question becomes *how many tokens does a build take, and what does a provider charge for them?*

## How a website build spends tokens

An AI website builder is not a single prompt. It runs an **agentic loop**: the model plans the site, writes files, compiles them, reads errors, fixes them, and repeats — often across dozens of turns — before it reports done. Each turn re-sends the conversation so far, so raw token counts look enormous.

The detail that keeps the cost low is **prompt caching**. The large, unchanging prefix of every request — the system prompt, the tool definitions, the skill instructions, the conversation history — is cached and re-read at a fraction of the normal input price (typically 10% of the input rate on most providers). So the *effective* token cost of a build is far below the cumulative count.

Measured across typical builds, a complete multi-page marketing site with a few rounds of revisions settles around:

| Token type | Effective tokens per build | Why |
|---|---|---|
| Input (cached + fresh) | ~250,000 | Replayed context, mostly cache reads |
| Output | ~80,000 | The generated code, edits, and agent reasoning |

These are *effective* figures after caching, for a 4–6 page site. A single landing page costs a fraction of this; a large multi-page app with heavy revision costs more. Use them as a midpoint, not a ceiling.

## What that costs on each provider

Applying those token figures to published June 2026 rates, the cost of one complete build falls into four clear tiers:

| Tier | Examples | Cost per complete site |
|---|---|---|
| **Free** | [Google Gemini](https://www.openthorn.app/build-with/google) free tier, [Groq](https://www.openthorn.app/build-with/groq), [Cerebras](https://www.openthorn.app/build-with/cerebras), [Ollama](https://www.openthorn.app/build-with/ollama) (local) | **$0** within daily limits |
| **Very cheap** | [DeepSeek](https://www.openthorn.app/build-with/deepseek), open models via [Together](https://www.openthorn.app/build-with/together) / [Fireworks](https://www.openthorn.app/build-with/fireworks), Gemini Flash (paid) | **single-digit cents** |
| **Mid-tier** | [Claude Sonnet](https://www.openthorn.app/build-with/anthropic), GPT mid-tier, [Mistral](https://www.openthorn.app/build-with/mistral) | **$0.50 – $2** |
| **Flagship** | GPT flagship, Claude's most capable models, [Grok](https://www.openthorn.app/build-with/xai) | **$1 – $3+** |

### A worked example: Claude Sonnet 4.6

Anthropic's published rate for Claude Sonnet 4.6 is **$3 per million input tokens and $15 per million output tokens**. For the reference build above:

- Input: 250,000 tokens × $3/M = **$0.75**
- Output: 80,000 tokens × $15/M = **$1.20**
- **Total: about $1.95** — and lower in practice, because cached input reads bill at roughly a tenth of that input rate.

That is the entire cost of generating a complete website. There is no platform fee on top: OpenThorn is free, so the API bill *is* the bill.

## How this compares to subscription builders

The credit-based builders price the same AI work very differently — as a recurring subscription, whether you build one site or none:

| Builder | Entry plan | What you get |
|---|---|---|
| Lovable | $25/month | ~100 credits (each edit ≈ 0.5–1.2+ credits) |
| Bolt.new | $25/month | ~10–13M tokens/month |
| v0 | $20/month | Metered credits over tokens |
| **BYOK (OpenThorn)** | **$0 platform fee** | **You pay raw token rates — cents to a few dollars per site** |

*(Competitor pricing verified June 12, 2026 against each vendor's pricing page; it changes often.)*

For someone building a handful of sites a year, the gap is stark: **$240–300 per year in subscriptions versus a few dollars in tokens.** For a team shipping constantly inside one platform, a subscription can still be worth it for the integrated workflow. The point is not that subscriptions are bad — it is that the AI work itself is cheap, and BYOK lets you pay only for that.

## How to make a build cost even less

- **Start on a free tier.** [Gemini](https://www.openthorn.app/build-with/google), [Groq](https://www.openthorn.app/build-with/groq), [Cerebras](https://www.openthorn.app/build-with/cerebras), [Mistral](https://www.openthorn.app/build-with/mistral), and [Cohere](https://www.openthorn.app/build-with/cohere) all issue free API keys with daily limits — enough to build your first sites for **$0**.
- **Match the model to the job.** Use a cheap, fast model (Gemini Flash, DeepSeek, an open model) for simple sites and quick iterations; save a flagship for complex, multi-page builds.
- **Run locally with [Ollama](https://www.openthorn.app/build-with/ollama).** Models run on your own hardware: no key, no token bill, nothing leaves your machine.
- **Set a provider spend limit.** Every provider lets you cap monthly spend or pre-fund a balance, so a build can never cost more than you allow.

## The bottom line

The AI work behind a complete website costs cents to a few dollars in tokens — the rest of what builders charge is subscription margin. If you want to pay only for the work, bring your own key: see [how to build a website with AI using your own API key](https://www.openthorn.app/blog/how-to-build-a-website-with-ai-byok), compare live model rates on the [pricing page](https://www.openthorn.app/pricing), or read the full [Lovable vs Bolt.new vs v0 pricing breakdown](https://www.openthorn.app/blog/lovable-vs-bolt-vs-v0-pricing).