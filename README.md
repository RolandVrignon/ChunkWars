# ⚔️ Chunk Wars

> The ultimate platform to create, test, and optimize your RAG (Retrieval-Augmented Generation) configurations

Chunk Wars is an advanced web platform that revolutionizes how you create and optimize your RAG systems. Upload your documents, choose from multiple intelligent chunking strategies, and discover which configuration works best for your use cases with our integrated battleground system.

![Chunk Wars Demo](/public/assets/screenshot.png)

## 🌟 Highlights

- **🤖 Intelligent Mistral AI OCR** - Text and image extraction with automatic annotations
- **📊 Advanced Chunking Templates** - Simple, recursive, or document-structure-based
- **⚔️ RAG Battleground** - Compare your setups side-by-side to identify the best performer
- **🎨 Enriched Markdown Display** - Professional rendering with annotated images
- **🔐 Secure Multi-tenant** - Complete user data isolation
- **🚀 Optimized Performance** - Parallel processing and production-ready Docker

## 🚀 Features

### 📄 Intelligent Chunking Strategies

**Mistral OCR (Recommended)**
- OCR extraction with Mistral AI for PDFs and images
- Automatic image annotations with descriptions
- Document structure-based hierarchical chunking
- Support for 16+ page documents
- Automatic page count detection

**Classic Templates**
- **Simple Overlap**: Character-based chunking with overlap
- **Recursive Overlap**: Intelligent recursive chunking preserving structure

### ⚔️ RAG Battleground

Compare your RAG configurations in real-time:

- **Retrieval Battleground**: Simultaneous search across multiple setups
- **Chunk Battleground**: Side-by-side chunk visualization
- **Intelligent Scoring**: Objectively identify the best configuration

### 🎨 Modern Interface

- **Markdown Display**: Professional rendering with `react-markdown` + Tailwind Typography
- **Enriched Images**: Automatic AI annotations for each image
- **Dark/Light Mode**: Adaptive interface
- **Real-time Progress**: Vectorization tracking with SSE

### 🔧 Complete Management

- **Multi-Setup**: Organize your projects in isolated configurations
- **Embedding Models**: OpenAI `text-embedding-3-small/large`
- **JSON Metadata**: CSV columns automatically indexed
- **Full Lifecycle**: Creation, review, vectorization, search, deletion

## 🛠️ Tech Stack

- **Framework**: [Next.js 15](https://nextjs.org/) (App Router) with TypeScript
- **Database**: [Supabase](https://supabase.com/) PostgreSQL + [pgvector](https://github.com/pgvector/pgvector)
- **ORM**: [Prisma](https://www.prisma.io/) with type-safe migrations
- **Auth**: [NextAuth.js](https://next-auth.js.org/) with Google SSO
- **AI**: [Mistral AI OCR](https://docs.mistral.ai/capabilities/OCR/) + [OpenAI Embeddings](https://openai.com/docs)
- **UI**: [Tailwind CSS](https://tailwindcss.com/) + [react-markdown](https://github.com/remarkjs/react-markdown)
- **Deployment**: [Docker](https://www.docker.com/) optimized multi-stage

## 🚀 Installation

### Prerequisites

- [Node.js](https://nodejs.org/) v20+
- [pnpm](https://pnpm.io/)
- [Docker](https://www.docker.com/) (optional)

### Local Setup

```bash
# 1. Clone the repository
git clone <your-repository-url>
cd chunk-wars

# 2. Install dependencies
pnpm install

# 3. Configure environment
cp .env.example .env.local
# Fill in environment variables (see section below)

# 4. Setup database
npx prisma migrate dev

# 5. Start development server
pnpm dev
```

The application will be available at [http://localhost:3000](http://localhost:3000).

## ⚙️ Configuration

Create a `.env.local` file with your credentials:

```env
# OpenAI API Key
OPENAI_API_KEY='...'
MISTRAL_API_KEY='...'

# Supabase
NEXT_PUBLIC_SUPABASE_URL='...'
NEXT_PUBLIC_SUPABASE_ANON_KEY='...'

# URL de connexion pour l'application via le pooler
DATABASE_URL='...'

# URL de connexion directe pour les migrations Prisma (mot de passe encodé)
DIRECT_URL='...'

GOOGLE_CLIENT_ID='...'
GOOGLE_CLIENT_SECRET='...'
AUTH_SECRET='...'
NEXTAUTH_URL='...'

#AWS IAM CREDENTIALS FOR S3 FILE STORAGE
AWS_ACCESS_KEY_ID='...'
AWS_SECRET_ACCESS_KEY='...'
AWS_REGION='...'
S3_BUCKET_NAME='...'
```

### API Configuration

**OpenAI**: [Create API Key](https://platform.openai.com/api-keys)
**Mistral AI**: [Sign up for Mistral](https://console.mistral.ai/)
**Google OAuth**: [Google Cloud Console](https://console.cloud.google.com/)
**Supabase**: [New Project](https://supabase.com/dashboard/projects)

## 🐳 Docker Deployment

Production-optimized configuration with [granular chunking](https://web.dev/articles/granular-chunking-nextjs):

```bash
# Build the image
docker build -t chunk-wars:latest .

# Run the container
docker run -p 3000:3000 --env-file .env.local chunk-wars:latest
```

The application will be accessible at [http://localhost:3000](http://localhost:3000).

## 📖 Usage Guide

### 1. 🔄 Create a Setup

1. Click **"+ New Chunk Setup"**
2. Choose your strategy:
   - **📄 Template**: Upload PDF/TXT with automatic chunking
   - **📊 CSV Upload**: Direct import of pre-formatted chunks

### 2. 🤖 Mistral OCR (Recommended)

1. Select **"Mistral OCR"**
2. Enter your PDF document URL
3. System automatically detects page count
4. Images are automatically annotated by AI
5. Chunking follows document hierarchical structure

### 3. ⚔️ Battleground Mode

1. On the **Chunks** page, activate **Battleground Mode**
2. Select 2+ setups to compare
3. **Retrieval**: Simultaneous search with scoring
4. **Chunk**: Side-by-side content visualization

### 4. 🔍 Vector Search

- Enter your query in the search bar
- Adjust result count (5-50)
- Results display with similarity scores
- Markdown rendered with annotated images

## 🎯 Future Vision

Chunk Wars is evolving toward a comprehensive RAG benchmarking platform:

- **🏆 Advanced Scoring**: Automatic performance metrics
- **📈 Analytics**: Performance dashboards for setups
- **🔄 A/B Testing**: Automated configuration testing
- **🌐 RESTful API**: Integration with existing workflows
- **🤝 Collaboration**: Team setup sharing

## 🤝 Contributing

This project follows [Effective Next.js Bundle Optimization](https://ujjwaltiwari2.medium.com/effective-next-js-bundle-optimization-with-webpack-cca8632ea03e) standards.

To contribute:
1. Fork the project
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [Mistral AI](https://mistral.ai/) for their revolutionary OCR API
- [OpenAI](https://openai.com/) for quality embeddings
- [Supabase](https://supabase.com/) for backend infrastructure
- [Tailwind CSS](https://tailwindcss.com/) for the design system

---

**⚔️ Let the chunk wars begin!**
