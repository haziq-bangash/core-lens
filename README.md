# Contract Lens

An agentic AI research platform that finds, analyzes, and cites information from the web and your personal research library.

![Contract Lens](/app/opengraph-image.png)

🔗 **[Try Contract Lens at contract-lens.ai](https://contract-lens.ai)**

## Features

### Research Tools

- **Web Search** — Search the web using Exa AI with support for multiple queries, search depths, and topic filtering
- **Academic Search** — Find scholarly papers and research articles with abstracts and summaries via Exa AI
- **Library Search** — Search across your personal research library of uploaded papers with RAG-powered retrieval
- **Extreme Search** — Deep, multi-step research for complex queries requiring extensive investigation
- **PDF Search** — Search within specific PDFs attached to a chat conversation
- **URL Retrieval** — Extract and analyze content from any URL with live crawling
- **Text Translation** — Translate research content between languages using AI models

### Research Library

- Upload and manage academic papers (PDF)
- Organize papers into collections with tags
- Full-text search across your entire library
- AI-generated notes and annotations
- Paper discovery panel for finding related work
- Cross-reference and synthesize across multiple papers using `@mentions`
- Inline citations with source tracking (paper title, section, page numbers)

### AI Models

Contract Lens supports **90+ AI models** across multiple providers:

| Provider | Models |
| :--- | :--- |
| **xAI** | Grok 4, Grok 4.1 Fast, Grok 3, Grok 3 Mini, Grok Code |
| **OpenAI** | GPT-5.2, GPT-5.1, GPT-5, GPT-4.1, o3, o4-mini, Codex |
| **Anthropic** | Claude Opus 4.5, Claude Sonnet 4.5, Claude Haiku 4.5 |
| **Google** | Gemini 3 Pro, Gemini 3 Flash, Gemini 2.5 Pro/Flash |
| **DeepSeek** | DeepSeek V3.2, DeepSeek R1 |
| **Alibaba** | Qwen 3 (4B–235B), Qwen 3 Coder, Qwen 3 VL |
| **Mistral** | Mistral Large, Magistral Medium/Small, Devstral |
| **Cohere** | Command A, Command A Reasoning |
| **GLM** | GLM 4.7, GLM 4.6, GLM 4.6V |
| **MiniMax** | MiniMax M2.1, M2 |
| **Others** | Kimi K2, Llama 3.3 70B, Trinity Mini, Nova 2 Lite |

Many models support both standard and thinking/reasoning modes.

## Tech Stack

- [Next.js](https://nextjs.org/) — React framework
- [Vercel AI SDK](https://sdk.vercel.ai/docs) — AI model integration and streaming
- [Exa AI](https://exa.ai/) — Web search and content retrieval
- [Tailwind CSS](https://tailwindcss.com/) — Styling
- [Shadcn/UI](https://ui.shadcn.com/) — UI components
- [PostgreSQL](https://www.postgresql.org/) + [Drizzle ORM](https://orm.drizzle.team/) — Database
- [Better Auth](https://github.com/better-auth/better-auth) — Authentication (GitHub, Google, X OAuth)
- [Redis](https://redis.io/) / [Upstash](https://upstash.com/) — Caching and rate limiting
- [Vercel AI Gateway](https://sdk.vercel.ai/docs/ai-sdk-core/settings#gateway) — Multi-provider model routing

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) 22+ or [Bun](https://bun.sh/)
- [pnpm](https://pnpm.io/) package manager
- PostgreSQL database
- API keys for AI providers (see Environment Variables below)

### Local Development

1. Clone the repository and install dependencies:
   ```bash
   pnpm install
   ```

2. Copy `.env.example` to `.env.local` and fill in your API keys

3. Run database migrations:
   ```bash
   pnpm drizzle-kit push
   ```

4. Start the development server:
   ```bash
   pnpm dev
   ```

5. Open `http://localhost:3000`

### Docker

#### Docker Compose (Recommended)

```bash
docker compose up
```

#### Docker Directly

```bash
docker build -t contract-lens.app .
docker run --env-file .env -p 3000:3000 contract-lens.app
```

The production image uses a multi-stage build with Node.js 22 Alpine for a minimal footprint.

### Environment Variables

<details>
<summary>Required server-side variables</summary>

| Variable | Purpose |
| :--- | :--- |
| `DATABASE_URL` | PostgreSQL connection string |
| `BETTER_AUTH_SECRET` | Authentication secret |
| `REDIS_URL` | Redis connection |
| `UPSTASH_REDIS_REST_URL` | Upstash Redis URL |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash Redis token |
| `XAI_API_KEY` | xAI / Grok models |
| `OPENAI_API_KEY` | OpenAI models |
| `ANTHROPIC_API_KEY` | Anthropic models |
| `GROQ_API_KEY` | Groq inference |
| `GOOGLE_GENERATIVE_AI_API_KEY` | Google Gemini models |
| `EXA_API_KEY` | Exa web/academic search |
| `TAVILY_API_KEY` | Tavily search |
| `FIRECRAWL_API_KEY` | Web scraping |
| `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` | GitHub OAuth |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google OAuth |
| `TWITTER_CLIENT_ID` / `TWITTER_CLIENT_SECRET` | X/Twitter OAuth |
| `RESEND_API_KEY` | Email delivery |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob storage |
| `QSTASH_TOKEN` | Message queue |

</details>

<details>
<summary>Required client-side variables</summary>

| Variable | Purpose |
| :--- | :--- |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | Google Maps |
| `NEXT_PUBLIC_VAPI_PUBLIC_KEY` | Voice assistant |

</details>

## Set Contract Lens as Your Default Search Engine

1. Open Chrome → **Settings** → **Search engine** → **Manage search engines and site search**
2. Click **Add** next to "Site search"
3. Set search engine name: `Contract Lens`
4. Set URL: `https://contract-lens.ai?q=%s`
5. Set shortcut: `sh`
6. Click the three dots next to it → **Make default**

## License

This project is licensed under the AGPLv3 License — see the [LICENSE](LICENSE) file for details.
