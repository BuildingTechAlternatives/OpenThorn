## What does BYOK mean?

BYOK stands for **bring your own key**. A BYOK AI website builder is a tool that generates websites with AI, but instead of charging you a subscription that bundles (and marks up) the AI cost, you connect your own API key from an AI provider — OpenAI, Anthropic, Google, or others. Your requests go straight to the provider you chose, and you pay that provider directly at their published rates.

That's the whole idea. The rest of this post explains why it matters and how it works in practice.

## How is BYOK different from a normal AI website builder?

Most AI website builders work like this: you pay a monthly subscription, the platform calls an AI model on your behalf, and the AI cost — plus a margin — is baked into your plan. You usually get a credit or message limit, and when you hit it, you upgrade.

A BYOK builder inverts that model:

- **You pay for AI usage at cost.** The provider bills you for exactly the tokens you used. There is no markup, because the platform never touches your billing.
- **There is no subscription wall.** Light month? You pay almost nothing. Heavy month? You pay for what you used — and you can see every request on your provider's dashboard.
- **You choose the model.** Want the highest-quality model for a complex app and a cheap one for small edits? With your own keys, that's your call, not a plan tier.
- **No lock-in through credits.** Your API credits live with the provider, not the platform. If you stop using the builder, you lose nothing.

## How much does a BYOK AI website builder cost?

With OpenThorn specifically: the platform is free. You only pay your AI provider for the tokens your builds consume. Generating a typical website costs cents to a few dollars depending on the model you pick — the [pricing page](/pricing) compares live per-token costs and quality across flagship models so you can choose deliberately.

## What do you need to get started?

Three things:

1. **An account with an AI provider.** For example [platform.openai.com](https://platform.openai.com) or [console.anthropic.com](https://console.anthropic.com). Most providers let you start with a small prepaid amount.
2. **An API key.** Generated in your provider's dashboard in about a minute.
3. **A BYOK builder.** Paste the key, describe what you want to build, and start.

OpenThorn supports 18 providers — including OpenAI, Anthropic, Google Gemini, DeepSeek, Mistral, Groq, xAI, RodiumAi, Amazon Bedrock, Azure OpenAI, and even local models via Ollama — so whichever ecosystem you already have credits with, you can use it.

## Is BYOK safe? What happens to my API key?

A serious BYOK platform never exposes your raw key. In OpenThorn, keys are encrypted server-side before storage and decrypted only at the moment a request is sent to the provider you selected. You stay in control: set spend limits in your provider dashboard, rotate keys whenever you like, and revoke a key instantly if you suspect exposure.

## Who is BYOK for?

BYOK fits anyone who wants AI-generated websites without the platform tax:

- **Developers** who already have API keys and don't want to pay twice for the same tokens.
- **Founders and indie hackers** who ship in bursts and resent paying subscriptions during quiet months.
- **Agencies** that build many sites and need usage costs to scale linearly, not by seat or plan tier.
- **Tinkerers** who want to compare models — or run them locally — instead of accepting whatever model a platform picked.

## Try it

OpenThorn is a BYOK AI website builder: describe what you want, get a complete, deployable website, and pay only your provider. Check the [FAQ](/faq) for common questions or [start building](/dashboard) with the keys you already have.
