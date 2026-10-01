# AutoForge Sentinel — Final Source Package

This package is the editable source for the public AutoForge Sentinel industrial quality and downtime-prediction digital twin.

## What is included

| Path | Purpose |
| --- | --- |
| `dist/index.html` | Complete frontend: Operations Deck UI, animated line, quality logic, packet ledger, fault controls, continuous-run mode and red-alert buzzer. |
| `worker/index.js` | Cloudflare Worker backend API. It serves the app and saves demo records. |
| `db/schema.ts` | Drizzle database schema. |
| `drizzle/` | Database migration files. |
| `scripts/build-backend.mjs` | Creates the Worker deployment build. |
| `scripts/validate-backend.mjs` | Checks the generated Worker bundle. |
| `.openai/hosting.json` | Existing Site configuration, including the logical `DB` binding. |
| `package.json` and `package-lock.json` | Required Node dependencies and commands. |

## Run the checks after any change

```bash
npm install
npm run build
npm run validate
```

`npm run build` generates the Worker bundle in `dist/server/`. That folder is generated output and is not the main place to edit.

## Where to make common changes

| You want to change | Edit this file |
| --- | --- |
| Text, colours, page layout, buttons, animated line | `dist/index.html` |
| Fault values, quality decision rules, buzzer behaviour | `dist/index.html` |
| Packet/event/work-order API behaviour | `worker/index.js` |
| Database tables or fields | `db/schema.ts`, then run `npm run db:generate` |

## Important notes

- The site uses a real persistent cloud database only for **simulated demo data**: packets, events and work orders.
- Browser sound needs one user click first. Click **Arm buzzer** or any control, then a red/reject fault can play the high-frequency simulated alert.
- The conveyor now keeps running during red/reject demo conditions. **Manual Safety Hold** is the only manual stop control.
- Do not put passwords, access tokens or API keys into these files.
- Keep `.openai/hosting.json` when updating the same Site; it connects the code to the existing project and database binding.
- For a simple local visual preview, you may serve `dist/`, but the `/api` database routes work only when deployed with the configured Worker and database binding.
- This is a digital-twin simulation. It does not control real machinery or replace industrial safety procedures.

## Safe update flow

1. Keep a copy of this ZIP before editing.
2. Edit the required source file.
3. Run the build and validation commands above.
4. Test the fault buttons and backend status after deployment.
5. If you need help, share the changed file or error message and ask for an update.
