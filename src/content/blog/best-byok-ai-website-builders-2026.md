BYOK — bring your own key — means an AI builder runs on an API key you get directly from a provider like OpenAI or Anthropic. You pay the provider's raw per-token rates; the tool itself adds no markup and needs no subscription. Most popular AI builders (Lovable, Bolt.new, v0) do **not** work this way: they resell AI usage as credits or token packs.

If you specifically want BYOK, the field is small. Here are the options worth knowing in 2026.

## 1. OpenThorn

[OpenThorn](https://www.openthorn.app) is a free, browser-based BYOK website builder. You connect a key from any of 17 providers (OpenAI, Anthropic, Google Gemini, DeepSeek, Mistral, Groq, and more), describe the site you want, and an agent generates complete React code with a live in-browser preview. One-click Netlify deploy, full code export, no platform fee of any kind. Disclosure: this is our product — the rest of this list is genuinely worth a look if it fits you better.

**Best for:** building and deploying complete websites without a subscription.

## 2. bolt.diy

[bolt.diy](https://github.com/stackblitz-labs/bolt.diy) is the open-source sibling of Bolt.new. You run it yourself (locally or self-hosted) and plug in keys for the model of your choice. Powerful and free, but it is a developer tool: expect to clone a repo and manage your own environment, and hosting the result is on you.

**Best for:** developers who want full control and don't mind self-hosting.

## 3. Dyad

[Dyad](https://www.dyad.sh) is a local, open-source AI app builder that runs on your machine with your own keys. Strong for building full-stack apps privately; less streamlined than hosted tools for going from prompt to a live deployed website.

**Best for:** local-first builders who want everything on their own machine.

## What about Lovable, Bolt.new, and v0?

They are capable builders, but none of them supports BYOK as of June 2026: Lovable sells monthly credits (Pro from $25/month), Bolt.new sells token packs (Pro $25/month), and v0 meters credits on its own plans (Premium $20/month). If predictable subscription billing suits you, they work well — see our detailed comparisons: [OpenThorn vs Lovable](/compare/lovable), [OpenThorn vs Bolt.new](/compare/bolt), [OpenThorn vs v0](/compare/v0).

## How to choose

- Want a hosted, zero-setup builder with no subscription → OpenThorn.
- Want open source and full control, comfortable with setup → bolt.diy.
- Want everything local and private → Dyad.

New to BYOK? Start with [what a BYOK AI website builder is](/blog/what-is-a-byok-ai-website-builder) and [how to get an API key](/blog/how-to-get-an-ai-api-key).
