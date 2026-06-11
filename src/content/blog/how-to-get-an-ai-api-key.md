Every BYOK tool — including OpenThorn — needs an API key from an AI provider. Getting one takes about five minutes. This guide covers the three most popular providers; the pattern is the same everywhere: create an account, add a payment method, generate a key, and set a spend limit.

## OpenAI

1. Go to [platform.openai.com](https://platform.openai.com) and sign up (this is separate from a ChatGPT subscription).
2. Add a payment method under Settings → Billing. New accounts may need a small prepaid credit.
3. Open **API keys**, click **Create new secret key**, and copy it — it is shown only once.
4. Under **Limits**, set a monthly budget so usage can never surprise you.

## Anthropic (Claude)

1. Go to [console.anthropic.com](https://console.anthropic.com) and create an account.
2. Add billing under **Plans & billing** — Claude API usage is prepaid or invoiced depending on tier.
3. Open **API keys**, create a key, and copy it.
4. Set a workspace spend limit under the workspace settings.

## Google Gemini

1. Go to [aistudio.google.com](https://aistudio.google.com) and sign in with a Google account.
2. Click **Get API key** — Google offers a free tier with rate limits, so you can start without billing.
3. For higher limits, enable billing on the associated Google Cloud project.

## Using the key

Paste the key into OpenThorn's Providers page — it is encrypted server-side and never exposed raw. Then describe the website you want and build. Full walkthrough: [how to build a website with AI using your own API key](/blog/how-to-build-a-website-with-ai-byok).

Three safety habits worth keeping: set a spend limit before you build anything, never commit a key to a public repo, and rotate keys occasionally from your provider dashboard.
