Building a website with AI no longer requires a subscription. With a BYOK (bring-your-own-key) builder like OpenThorn, you connect an API key from an AI provider you already trust, describe what you want, and pay only for the tokens you use — typically cents to a few dollars per site.

Here is the full process, start to finish.

## Step 1: Choose an AI provider and get an API key

Any of OpenThorn's 18 supported providers works: OpenAI, Anthropic, Google Gemini, DeepSeek, Mistral AI, Groq, Together AI, xAI, Cohere, Perplexity, OpenRouter, RodiumAi, Ollama, Fireworks AI, Cerebras, Azure OpenAI, Amazon Bedrock, or NVIDIA NIM. If you are unsure, OpenAI or Anthropic are the easiest starting points. See our guide on [how to get an API key](/blog/how-to-get-an-ai-api-key) for exact steps.

## Step 2: Create a free OpenThorn account

Sign up at [openthorn.app](https://www.openthorn.app). The platform itself is free — there is no trial, no credit card, and no subscription tier to pick.

## Step 3: Connect your API key

Open the Providers page in the app and paste your key. Keys are encrypted server-side with AES-256-GCM and never exposed raw to the browser. You stay in control through your provider's dashboard: set spend limits, watch usage, rotate the key any time.

## Step 4: Describe the website you want

Create a project and write a plain-language description: the kind of site, the pages it needs, the tone, anything you care about. OpenThorn's agent plans the build, generates real React code, and compiles it in your browser as it works.

## Step 5: Preview and iterate

The live preview runs entirely in your browser. Ask for changes the same way you asked for the site — "make the hero darker", "add a contact form" — and the agent edits the code. The agent verifies its own work with compile checks and an interactive smoke test before it reports done.

## Step 6: Deploy or export

One click deploys to Netlify on a public URL. Or export the full source as a zip — it is standard React + Vite code that runs anywhere. There is no export paywall and no proprietary format.

## What it costs

OpenThorn charges nothing. Your provider bills you for tokens at their published rates — compare models on the [pricing page](/pricing). A typical site costs between a few cents (budget models like DeepSeek or Gemini Flash) and a few dollars (flagship models like Claude or GPT).
