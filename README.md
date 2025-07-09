# FastRAG

FastRAG is a web platform designed to streamline the process of creating, managing, and querying Retrieval-Augmented Generation (RAG) projects. It provides a user-friendly interface to upload CSV data, vectorize it using state-of-the-art OpenAI models, and perform powerful semantic searches on your custom knowledge bases.

## Core Features

- **Multi-Project Management**: Organize your work into separate, isolated projects.
- **Secure User Authentication**: Google SSO integration powered by NextAuth.js ensures that users can only access their own projects.
- **Dynamic CSV Processing**: Upload a CSV file, specify a `chunk` column for vectorization, and all other columns are automatically stored as queryable JSON metadata.
- **Choice of Embedding Models**: Select from different OpenAI models (`text-embedding-3-small`, `text-embedding-3-large`) for each project. The API automatically handles different output dimensions.
- **Parallel Batch Processing**: For fast and efficient embedding generation, the backend processes CSV rows in parallel batches of 15.
- **Real-time Progress Bar**: Monitor the vectorization process with a live progress bar.
- **Powerful Semantic Search**: Once a project is processed, perform similarity searches to retrieve the most relevant chunks based on your query.
- **Full Project Lifecycle**: Create, list, and securely delete projects. Deleting a project automatically removes all associated documents and embeddings.
- **Dockerized for Deployment**: Comes with an optimized, multi-stage `Dockerfile` for easy and reproducible deployments.

## Tech Stack

- **Framework**: [Next.js](https://nextjs.org/) (App Router)
- **Database**: [Supabase](https://supabase.com/) (PostgreSQL) with the [pgvector](https://github.com/pgvector/pgvector) extension.
- **ORM**: [Prisma](https://www.prisma.io/) for type-safe database access and migrations.
- **Authentication**: [NextAuth.js](https://next-auth.js.org/)
- **Vector Embeddings**: [OpenAI API](https://openai.com/docs)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)
- **Deployment**: [Docker](https://www.docker.com/)

## Getting Started

Follow these steps to get a local instance of the application up and running.

### Prerequisites

- [Node.js](https://nodejs.org/en/) (v20 or later)
- [pnpm](https://pnpm.io/)
- [Docker](https://www.docker.com/products/docker-desktop/)

### 1. Clone the Repository

```bash
git clone <your-repository-url>
cd fastrag
```

### 2. Install Dependencies

```bash
pnpm install
```

### 3. Set Up Environment Variables

Create a `.env.local` file in the root of the project by copying the example file:

```bash
cp .env.example .env.local
```

Now, fill in the `.env.local` file with your credentials.

```env
# OpenAI API Key
OPENAI_API_KEY="sk-..."

# NextAuth.js - Generate a secret with `openssl rand -base64 32`
AUTH_SECRET="..."

# Google OAuth Credentials (from Google Cloud Console)
GOOGLE_CLIENT_ID="..."
GOOGLE_CLIENT_SECRET="..."

# Supabase Connection URLs (from Supabase Project Settings -> Database)
# Used by the app for queries at runtime (connection pooling)
DATABASE_URL="postgresql://postgres:[YOUR-PASSWORD]@aws-0-...a.com:6543/postgres?pgbouncer=true"
# Used by Prisma Migrate to modify the database schema
DIRECT_URL="postgresql://postgres:[YOUR-PASSWORD]@db....supabase.co:5432/postgres"

# Supabase Public Keys (from Supabase Project Settings -> API)
# Used by the Supabase client for specific RPC calls
NEXT_PUBLIC_SUPABASE_URL="..."
NEXT_PUBLIC_SUPABASE_ANON_KEY="..."
```

### 4. Run Database Migrations

Prisma will read your `schema.prisma` file and set up the database schema, including the custom SQL functions.

```bash
npx prisma migrate dev
```

### 5. Run the Development Server

```bash
pnpm dev
```

The application should now be running at [http://localhost:3000](http://localhost:3000).

## Deployment with Docker

The included `Dockerfile` is optimized for production deployment.

### 1. Build the Docker Image

This command builds the image, passing the necessary `OPENAI_API_KEY` as a build argument.

```bash
docker build -t your-docker-username/fastrag:latest .
```

### 2. Run the Docker Container

This command runs the container, exposing it on port 3000 and passing all the necessary runtime environment variables from your `.env.local` file.

```bash
docker run -p 3000:3000 --env-file .env.local your-docker-username/fastrag:latest
```

The application will be accessible at [http://localhost:3000](http://localhost:3000).
