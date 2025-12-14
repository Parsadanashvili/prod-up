# ProdUp - AI Standup Platform

An AI-powered platform that replaces traditional standups with intelligent task extraction, async updates, and AI-generated summaries.

## Features

- **Chat Interface**: Natural language conversation with an AI project manager
- **AI Task Extraction**: Automatically extracts tasks from your messages
- **Status Updates**: AI understands status keywords ("done", "blocked", "in progress", etc.)
- **Weekly Grouping**: Tasks organized by week (Monday-Friday)
- **AI-Generated Summaries**: Compare Monday plans vs Friday outcomes

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **AI SDK**: Vercel AI SDK with OpenRouter provider
- **Database**: Vercel Postgres with pgvector extension
- **Auth**: NextAuth.js v5
- **UI**: shadcn/ui components with Tailwind CSS

## Getting Started

### Prerequisites

- Node.js 18+ or Bun
- PostgreSQL database (Vercel Postgres recommended)
- OpenRouter API key

### Installation

1. Clone the repository:
```bash
git clone <your-repo-url>
cd prod-up
```

2. Install dependencies:
```bash
bun install
# or
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env
```

Edit `.env` and add:
```
OPENROUTER_API_KEY=your_openrouter_api_key
DATABASE_URL=postgresql://user:password@host:port/database
NEXTAUTH_SECRET=your_random_secret_here
NEXTAUTH_URL=http://localhost:3000
```

4. Initialize the database:
```bash
bun run init-db
```

5. Run the development server:
```bash
bun dev
# or
npm run dev
```

6. Open [http://localhost:3000](http://localhost:3000) in your browser

## Usage

1. **Sign In**: Enter your email to create/get started
2. **Chat**: Go to the Chat page and start talking to your AI project manager
   - Example: "I'm working on the login page and fixing the bug in the payment flow"
3. **View Tasks**: Check the Tasks page to see extracted tasks organized by week
4. **Get Summary**: Visit the Summary page to see AI-generated weekly summaries

## Project Structure

```
app/
  api/          # API routes (chat, tasks, summary, weeks)
  auth/         # Authentication pages
  chat/          # Chat interface
  tasks/         # Tasks view
  summary/       # Summary view
components/
  chat/          # Chat components
  tasks/         # Task components
  summary/       # Summary components
lib/
  ai/            # AI services (task extraction, summary generation)
  db/            # Database queries and schema
  auth.ts        # Auth utilities
```

## API Routes

- `POST /api/chat` - Chat with AI and extract tasks
- `GET /api/tasks` - Get tasks (by userId or weekId)
- `POST /api/tasks` - Create a task
- `PATCH /api/tasks` - Update a task
- `DELETE /api/tasks` - Delete a task
- `GET /api/summary` - Generate weekly summary
- `GET /api/weeks` - Get weeks for a user

## Database Schema

- **users**: User accounts
- **tasks**: Extracted tasks with status
- **weeks**: Weekly groupings (Monday-Friday)
- **messages**: Chat message history
- **task_embeddings**: Vector embeddings for semantic search (pgvector)

## Development

The database schema is automatically created on first run via `scripts/init-db.ts`. Make sure your `DATABASE_URL` is set correctly before running the initialization script.

## Deployment

1. Set up a Vercel Postgres database
2. Configure environment variables in Vercel
3. Deploy to Vercel:
```bash
vercel
```

## License

MIT
