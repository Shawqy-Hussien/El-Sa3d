# El-Sa3d Pharmacy Platform

Original pharmacy platform monorepo using npm workspaces, React/Vite, Expo, Express, and PostgreSQL.

## Setup

Requirements: Node.js 20.19+, npm 10+, and Docker Compose.

1. Copy `.env.example` to `.env`; replace the local database password placeholder and keep `DATABASE_URL` in sync.
2. Run `npm install`.
3. Start PostgreSQL with `npm run db:up`.
4. Apply the API schema with `npm run db:migrate`.
5. Start the web app with `npm run dev`, or start another workspace with `npm run dev --workspace @elsa3d/admin`, `@elsa3d/pharmacist`, `@elsa3d/mobile`, `@elsa3d/delivery`, or `@elsa3d/api`.

The Vite apps listen on ports 5173, 5174, and 5175. Expo starts its development server for the selected mobile app. The API listens on port 3001; `/api/v1/health/live` and `/api/v1/health/ready` provide health checks.

Run `npm run build`, `npm run typecheck`, `npm run lint`, `npm test`, and `npm run format` from the repository root. See [docs/PROGRESS.md](docs/PROGRESS.md) for verified scope and remaining work.

Authentication endpoints and client transport requirements are documented in [docs/api/authentication.md](docs/api/authentication.md); interactive API docs are served at `/api/docs`.
