# MindFort Vulnerability Graphing

A modern, interactive web application for visualizing, querying, and enriching cybersecurity vulnerability data using a graph-based approach.

## 🚀 What is this?

MindFort Vulnerability Graphing is a Next.js/React app that lets you:

-   **Chat with a security assistant** to ask questions about your vulnerability data
-   **Visualize findings and relationships** in a graph (Neo4j-powered)
-   **Enrich and analyze** findings with LLM-powered tools
-   **Store and recall context** for smarter, more contextual answers

## 🧑‍💻 How to Use

-   Start the app locally (see below)
-   Use the chat to ask about vulnerabilities, best practices, or specific findings
-   Visualize your data in the graph view
-   Enrich your data with advanced tools (Cypher queries, LLM enrichment, etc.)

## 🛠️ Development Setup

1. **Clone the repo:**
    ```bash
    git clone <this-repo-url>
    cd mindfort-vuln-graphing
    ```
2. **Install dependencies:**
    ```bash
    npm install
    # or
    yarn install
    ```
3. **Configure environment:**
    - Copy `.env.example` to `.env.local` and fill in your API keys, Neo4j connection, etc.
4. **Run the app locally:**
    ```bash
    npm run dev
    # or
    yarn dev
    ```
5. **Open in browser:**
    - Visit [http://localhost:3000](http://localhost:3000)

## 🧩 Technologies Used

-   **Next.js** (App Router)
-   **React** (with hooks)
-   **TypeScript**
-   **Tailwind CSS** (with custom design)
-   **Neo4j** (graph database)
-   **LangChain** (LLM orchestration)
-   **Zod** (runtime validation)
-   **OpenAI/LLM APIs**

## 🤝 Contributing & Development Notes

-   All types and schemas are defined in `src/app/models/finding.ts` using Zod for runtime safety.
-   Linting is relaxed for unused variables/imports to ease rapid prototyping.
-   The chat UI is in `src/components/Chat.tsx` and is fully type-safe.
-   API routes are in `src/app/api/` and use Next.js API handlers.
-   For graph enrichment and Cypher queries, see `src/lib/agentTools.ts` and `src/app/api/enrich/route.ts`.
-   PRs and issues are welcome!

## 📝 Special Notes

-   This project is designed for rapid prototyping and research. Some features (like memory, enrichment, etc.) are experimental.
-   Make sure your Neo4j instance and LLM API keys are set up before running locally.
-   For best results, use Node.js 18+ and the latest npm/yarn.

---

Enjoy exploring and analyzing your security findings with MindFort Vulnerability Graphing!
