# Take-Home Todo

A full-stack Todo application built with React, TypeScript, Express, Prisma, and PostgreSQL.

## Features

- Create, edit, complete, delete, and filter todos
- Store todos in PostgreSQL via Prisma ORM
- Priority and due-date fields
- Optimistic completion and deletion updates
- Real-time sync across open clients with server-sent events
- Production build serves the React app and API from one Node service
- Docker Compose for local PostgreSQL

## Tech Stack

- Frontend: React + TypeScript + Vite
- Backend: Express + TypeScript
- Database: PostgreSQL
- ORM: Prisma

## Local Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create an environment file:

   ```bash
   cp .env.example .env
   ```

3. Start PostgreSQL:

   ```bash
   docker compose up -d
   ```

4. Run migrations:

   ```bash
   npm run prisma:migrate
   ```

5. Start the app:

   ```bash
   npm run dev
   ```

The frontend runs at `http://localhost:5173` and proxies API calls to `http://localhost:3000`.

## Production

Build and run:

```bash
npm run build
npm run prisma:deploy
npm start
```

The production server serves both the API and the compiled React frontend.

## Deployment Notes

This app includes `render.yaml` and is ready for Render Blueprint deployment, Railway, Fly.io, or any Node host with a PostgreSQL database.

Required environment variables:

- `DATABASE_URL`
- `PORT`
- `NODE_ENV=production`

Suggested deployment flow:

1. Push this repository to GitHub.
2. Create a managed PostgreSQL database.
3. Create a Node web service from the GitHub repo.
4. Set build command to `npm install && npm run build && npm run prisma:deploy`.
5. Set start command to `npm start`.
6. Add the database connection string as `DATABASE_URL`.

## Submission

- GitHub repository link: add after pushing the repo
- Live deployment link: add after deploying the service
