Lovable, Bolt.new, and v0 are the three most popular AI app builders in 2026 — and they all price the same way: you buy AI usage from the platform, marked up, as credits or token packs. This post compares what each actually costs, where each one shines, and what the bring-your-own-key (BYOK) alternative looks like.

All prices below were verified on June 12, 2026 against each vendor's public pricing page. They change often — always check the linked pages for current numbers.

## The short version

- **Lovable** — strongest all-round app builder; Pro from [$25/month](https://lovable.dev/pricing) for ~100 credits, with each edit consuming roughly 0.5–1.2+ credits.
- **Bolt.new** — best in-browser dev environment (by StackBlitz); Pro from [$25/month](https://bolt.new/) for ~10–13M tokens. Free tier caps at 1M tokens/month.
- **v0** — best for Next.js/Vercel teams; free tier includes ~$5/month in credits, Premium at [$20/month](https://v0.app/pricing).
- **BYOK tools (like OpenThorn)** — free platform, you pay your AI provider's raw token rates. A typical complete website costs cents to a few dollars, total.

## What you're actually paying for

All three platforms buy inference from AI providers (OpenAI, Anthropic, Google) at wholesale per-token rates and resell it to you in their own unit — credits or packs. The markup funds the product, which is fair. But it has two structural consequences:

1. **Unused budget expires.** Credits and token packs reset monthly. A quiet month still costs $20–25.
2. **You can't pick the model.** The platform decides which model serves your request. When a better or cheaper model ships, you wait for the platform to adopt it.

For scale: Anthropic's published rate for Claude Sonnet 4.6 is [$3 per million input tokens and $15 per million output tokens](https://www.anthropic.com/pricing). A complete landing page generation typically consumes well under a million tokens end to end — which is why BYOK sites cost cents to single-digit dollars.

## Lovable vs Bolt.new vs v0, head to head

| | Lovable | Bolt.new | v0 |
|---|---|---|---|
| Entry paid plan | $25/mo (Pro, ~100 credits) | $25/mo (Pro, ~10M tokens) | $20/mo (Premium) |
| Free tier | ~5 credits/day | 1M tokens/mo (300K/day cap) | ~$5/mo in credits |
| Bring your own key | No | No (bolt.diy, self-hosted, does) | No |
| Model choice | Platform decides | Platform decides | v0 model tiers |
| Code export | GitHub sync | Download/GitHub | Export + Git |
| Standout strength | Polish, full-stack apps | In-browser dev environment | Next.js UI quality |

**Choose Lovable** if you want the most polished end-to-end app builder and don't mind the credit model. **Choose Bolt.new** if you live in the browser and value the StackBlitz environment. **Choose v0** if your stack is Next.js on Vercel — its UI generation there is best in class.

## The BYOK alternative

If the subscription math bothers you — paying $25/month whether you build two sites or zero — the alternative is bringing your own API key. [OpenThorn](https://www.openthorn.app/) is free: you connect a key from any of 18 providers (OpenAI, Anthropic, Google Gemini, DeepSeek, Groq, RodiumAi, and more), the agent generates a complete React site, and you pay your provider's raw token rate. No markup, no monthly reset, no model lock-in. Several providers — [Google Gemini](https://www.openthorn.app/build-with/google), [Groq](https://www.openthorn.app/build-with/groq), [Cerebras](https://www.openthorn.app/build-with/cerebras) — even have free API tiers, making the first site genuinely $0.

The trade-off is honest: you manage an API key (five minutes, [guide here](https://www.openthorn.app/blog/how-to-get-an-ai-api-key)) and you don't get Lovable's polish or Bolt's dev environment. What you get instead is raw pricing, any model, and full ownership of the exported source.

## Bottom line

For most people building a handful of websites a year, the math is stark: $240–300/year in subscriptions versus a few dollars in tokens. For teams shipping constantly inside one of these platforms, the subscription can be worth it for the workflow alone. Know which one you are — then pick accordingly.

See the detailed one-on-one comparisons: [OpenThorn vs Lovable](https://www.openthorn.app/compare/lovable), [OpenThorn vs Bolt.new](https://www.openthorn.app/compare/bolt), [OpenThorn vs v0](https://www.openthorn.app/compare/v0).
