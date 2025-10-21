# Amp Sales Workbench - Web UI

Modern React + shadcn/ui frontend for the Amp Sales Workbench.

## Getting Started

From the project root:

```bash
# Install dependencies (first time only)
cd web && npm install && cd ..

# Start both API server and Next.js dev server
npm run start:web

# Or run them separately:
npm run api    # API server on :3001
npm run web    # Next.js on :3000
```

Then open [http://localhost:3000](http://localhost:3000)

## Architecture

- **Frontend**: Next.js 15 + React 19 + shadcn/ui
- **API**: Express server (`../api-server.ts`) on port 3001
- **Styling**: Tailwind CSS with shadcn/ui components

## Features

- Clean, modern UI inspired by shadcn/ui design system
- Account selector with capability badges
- Quick action buttons for all agents
- Tabs for different workflows (Prep, After Call, CRM, Insights)
- Real-time agent execution

## Tech Stack

- Next.js 15 (App Router)
- React 19
- TypeScript
- Tailwind CSS
- shadcn/ui components
- Lucide icons
