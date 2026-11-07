New to this? The setup guide in Jobs Ireland walks through it: it asks what matters most to you, shows where to go and what to copy, and checks the key. It opens by itself on a fresh install, and from **Settings → About** after that. The sections below are the same steps, for when something looks different from what the guide says.

Or open **Settings → AI provider**, pick one, and press **Test connection**:

- **Local model:** Ollama or llama.cpp on your own hardware. Private and free, but slower; see [below](#local-model-with-ollama) for setup and model sizes.
- **LM Studio:** a model you run in LM Studio, on this computer or your network; see [below](#lm-studio).
- **OpenAI-compatible:** OpenAI itself or any server that speaks its API (OpenRouter, OpenCode, Ollama's cloud, vLLM and others). Enter its address, your API key and the model; see [below](#openai-compatible-servers) for some addresses.
- **Anthropic:** Claude models with your own API key.
- **Mistral:** Mistral's models with your own API key, from Mistral's console; see [below](#mistral). The model list shows the ones your plan includes. Mistral sets limits per workspace: if **Test connection** says the key can make 0 requests a minute, check the workspace's billing there.

A subscription to ChatGPT Plus, Claude Pro or a Google AI plan doesn't include API use: the API is paid for separately, as credit you buy first. Free hosted tiers aren't recommended for Jobs Ireland. On Gemini's free tier, Google may use what you send to improve its products and people may read it, and Mistral's free mode may train on it too; resumes don't belong there. Jobs Ireland's free and private choice is a model on your own computer.

API keys are stored encrypted with `JOBS_IRELAND_SECRET` and never sent back to the browser. **Never invent experience** (on by default) keeps drafts to facts from your profile and flags anything it can't find there.

You can also set the provider with the `JOBS_IRELAND_AI_*` [environment variables](Environment-variables.md); a choice saved in Settings wins.

## OpenAI

1. Sign up or sign in on [OpenAI's platform](https://platform.openai.com/).
2. Under **Billing**, add a card and buy at least $5 of credit. Auto-reload is switched on unless you switch it off.
3. Open [API keys](https://platform.openai.com/api-keys) and press **Create new secret key**. The first key needs a phone that can take a code by text message or WhatsApp. The key is shown only once.
4. In Jobs Ireland, choose **OpenAI-compatible** with the address `https://api.openai.com/v1`, or OpenAI in the setup guide.

Pick a model yourself: `gpt-6.1-terra` is what the setup guide uses. OpenAI's "not sure where to start" suggestion is one of its most expensive models. The API doesn't train on what's sent unless you opt in.

## Anthropic

1. Sign up or sign in on [Claude's platform](https://platform.claude.com/).
2. Open [Billing](https://platform.claude.com/settings/billing) and press **Buy credits**.
3. Open [API keys](https://platform.claude.com/settings/keys) and press **Create key**. Choose a workspace (the default one is fine): a key without one is refused, since Jobs Ireland doesn't send a workspace ID. Set it to **Never** expire, which can't be changed later. The key starts with `sk-ant-` and is shown only once.

The setup guide uses `claude-sonnet-5-5`. Anthropic doesn't train on API traffic by default.

## Gemini

Google's models, through [Google AI Studio](https://aistudio.google.com/) and its OpenAI-compatible address.

1. Sign in to AI Studio with your Google account and accept its terms.
2. On the [API keys](https://aistudio.google.com/api-keys) page, press **Set up billing**, link a billing account and buy at least $5 of credit. Do this before you use the key: with billing, Google doesn't use what you send to improve its products.
3. On the same page, press **Create API key**.
4. In Jobs Ireland, choose **OpenAI-compatible** with the address `https://generativelanguage.googleapis.com/v1beta/openai`, your key and a model such as `gemini-3.5-flash-lite`, or Gemini in the setup guide.

Jobs Ireland hasn't been tried with Gemini yet. If something doesn't work, please [open an issue](https://github.com/chrisnol6073/dossier/issues) or email chrisnol6073@gmail.com.

## Mistral

1. Sign up or sign in on [Mistral's console](https://console.mistral.ai/).
2. Under **Billing**, add a payment method, turn on pay-as-you-go and press **Add credits**.
3. In the **Admin Panel**, open **Privacy** and switch off **Anonymous improvement data**, so Mistral doesn't use what Jobs Ireland sends to improve its models.
4. Open [API keys](https://console.mistral.ai/api-keys) and create a key. It's shown only once.

The setup guide uses `mistral-small-2603`. Mistral Medium is being retired, and Mistral Large 4 is in preview, where Mistral's terms say opt-outs don't apply: avoid it for resumes.

## OpenAI-compatible servers

Enter the address the server's documentation gives for its OpenAI API. Some that work:

| Server | Address |
|---|---|
| OpenAI | `https://api.openai.com/v1` |
| OpenRouter | `https://openrouter.ai/api/v1` (`https://openrouter.ai` works too). Jobs Ireland asks it to skip the companies behind its models that keep or train on prompts; in [its privacy settings](https://openrouter.ai/settings/privacy), don't allow them either. Keys made during OpenRouter's onboarding expire after 180 days. |
| Ollama's cloud | `https://ollama.com/v1` |
| DeepSeek | `https://api.deepseek.com` |

For OpenCode, the `…/openai/v1` address in its docs works: Jobs Ireland uses the `…/v1` one next to it, where the model list is too. Jobs Ireland knows a few servers by their address and asks them the way they need, for example DeepSeek's models without thinking first, and Ollama's cloud with the answer's format in the instructions. Without a key, Jobs Ireland sends none, so a server with a public model list shows it. A model that thinks for so long that its answer gets cut off is asked once more, with more room.

## Local model with Ollama

With a local model, your profile, postings and documents never leave your server. The Compose file can run Ollama next to Jobs Ireland. Switch it on, start it, and pull a model:

```bash
echo "COMPOSE_PROFILES=ai" >> .env
docker compose up -d
docker compose exec ollama ollama pull qwen2.5:7b
```

Then, in **Settings → AI provider → Local model**, set the server address to `http://ollama:11434`, pick the model and press **Test connection**. Or set `JOBS_IRELAND_AI_PROVIDER=local`, `JOBS_IRELAND_AI_URL=http://ollama:11434` and `JOBS_IRELAND_AI_MODEL=qwen2.5:7b` in `.env`.

On CapRover, Coolify or Dokploy, the guide for it shows how to run Ollama there: see [Self-host on a server](Home#self-host-on-a-server).

**Which model:** `qwen2.5:7b` is a good start: a 4.7 GB download that needs about 6 GB of memory with Jobs Ireland's 16k-token context. On a smaller server, `qwen2.5:3b` (2 GB, about 3 GB of memory) works, with plainer writing. Models that think before they answer, such as `qwen3.5:4b`, work too: Jobs Ireland has Ollama's models answer without thinking first. These are suggestions, not yet benchmarked. On a CPU, reading a posting takes a minute or two and a whole new application several minutes, so the local timeout is 5 minutes per request (`JOBS_IRELAND_AI_TIMEOUT_SECONDS`); 4 or more cores help, a GPU much more.

**Ollama elsewhere:** on another machine in your network, use `http://<its address>:11434`, and start Ollama there with `OLLAMA_HOST=0.0.0.0` so it listens beyond localhost. For Ollama installed on the same server outside Docker, use `http://host.docker.internal:11434`, which `compose.yml` points at the server; Ollama then has to listen beyond localhost too, so make sure your firewall keeps port 11434 closed to the internet. Inside a container, `localhost` is the container itself, never the server.

## LM Studio

Start the server in [LM Studio](https://lmstudio.ai)'s **Developer** tab (0.4 or later; it listens on port 1234). There's no need to load a model first. In **Settings → AI provider → LM Studio**, the address `http://host.docker.internal:1234` is LM Studio on the computer Jobs Ireland's Docker runs on; for one on another machine, use `http://<its address>:1234`. If **Test connection** can't reach it, turn on **Serve on Local Network** in LM Studio's server settings, and keep port 1234 closed to the internet. The **API token** is only needed if you've turned on authentication there.

Pick a model from the list; embedding models aren't offered. When it isn't loaded, Jobs Ireland loads it with 16,384 tokens of context (or the model's maximum, if that's less), and it stays loaded until you eject it in LM Studio. If you've loaded it yourself with less context, Jobs Ireland says so instead of reloading it. Reading postings runs with the model's thinking off; writing leaves it room to think first.

## Scoring with Jev

**Score** in Find jobs and the job agent use your AI model to judge how well a posting fits you. In **Settings → Scoring** you can choose **Jev by TypeSafe** instead: a model made for quick judgments, with a TypeSafe key of your own from [TypeSafe's console](https://console.typesafe.ai/keys). Jev answers questions about the posting, and Jobs Ireland builds the score from them. The reasons quote the posting's own lines: "Covers: …" for what your profile shows, "Missing: …" for what it doesn't. Drafts are still written by your AI model.

Each posting you score goes to TypeSafe with your profile, without your name, contact details or references (see [Privacy](Privacy.md)). Jev reads English best, so it judges postings in other languages less well. `JOBS_IRELAND_SCORER` and `JOBS_IRELAND_TYPESAFE_KEY` set the defaults (see [Environment variables](Environment-variables.md)).


---

_Adapted from the [Dossier wiki](https://github.com/AienTech/dossier/wiki), the AGPL-3.0 project Jobs Ireland is based on._
