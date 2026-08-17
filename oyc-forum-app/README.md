# OYC Forum

A member forum / club portal for the Oshkosh Yacht Club, built on Astro + Cloudflare Workers, D1, and R2.

## Stack

- **Astro** (`output: "server"`) with the `@astrojs/cloudflare` adapter, deployed via Wrangler to Cloudflare Workers
- **Cloudflare D1** (SQLite) for all relational data, accessed via `env.DB` from `cloudflare:workers`
- **Cloudflare R2** for file/photo attachments, bound as `env.ATTACHMENTS`
- Manual magic-link authentication (no third-party auth provider) with email delivery via **Resend**

## Local development

```
npm install
npx wrangler d1 execute oyc-forum-db --local --file=./schema.sql
npm run dev
```

`schema.sql` uses `CREATE TABLE IF NOT EXISTS` (and `INSERT OR IGNORE` for seed data), so it's safe to re-run any time the schema changes — it only adds what's missing.

Environment variables (in `.dev.vars` locally, and as Worker secrets in production):

- `RESEND_API_KEY` — Resend API key used to send magic-link login emails
- `RESEND_FROM_EMAIL` — the "from" address for those emails

Regenerate `worker-configuration.d.ts` after changing bindings in `wrangler.jsonc`:

```
npm run cf-typegen
```

## Data model

| Table | Purpose |
|---|---|
| `users` | Member accounts: email, name, phone, role, approval status |
| `categories` | Forum categories/boards: name, description, minimum role to view/post, enabled flag |
| `topics` | Threads within a category; optional `topic_type` tag (e.g. Crew Wanted, Buy/Sell/Trade) |
| `posts` | Replies within a topic (the topic's own first message is also a `posts` row) |
| `attachments` | Files/photos attached to a post, stored in R2 (`r2_key`) |
| `login_tokens` | Single-use, time-limited magic-link tokens |
| `sessions` | Cookie-backed login sessions |
| `groups` | Named member groups (e.g. boat fleets) |
| `user_groups` | Join table: which users belong to which groups |

Seeded groups: E Boat, Opti, Laser, M15, X Boat.

## Roles and access control

Roles are ranked in `src/lib/roles.ts`:

```
guest (0) < member (1) < moderator (2) < board (3) < admin (4)
```

`canAccessCategory(userRole, category.minimum_role)` gates both viewing and posting: a category is visible/postable only to users whose role rank is at or above the category's `minimum_role`. Disabled categories (`enabled = 0`) are hidden from everyone regardless of role.

## Authentication flow

1. `/api/login` — user submits their email; a random token is stored in `login_tokens` (60-minute expiry) and emailed via Resend as a magic link.
2. `/api/verify` — validates the token, creates the user record if new (default role `member`, `approved = 0`), creates a `sessions` row, and sets a `session_token` cookie (`httpOnly`, `sameSite=lax`, `secure` only over HTTPS — required for Safari, which unlike Chrome does not treat `localhost` as exempt from the Secure-cookie rule).
3. `src/middleware.ts` resolves the cookie into `Astro.locals.user` on every request.
4. New members land on `/pending-approval` until an admin approves them from the admin panel; only approved members can post.

## Features by phase

1. **Read-only browsing** — categories → topics → posts.
2. **Posting** — new topic and reply forms/endpoints (`new-topic.astro`, `topic/[id]/reply.astro`, `api/topic.ts`, `api/post.ts`).
3. **Auth** — magic-link login, member approval queue, role/category gating.
4. **Club portal categories** — real OYC categories with role gating, plus `topic_type` tagging for Crew Finder / Marketplace-style posts.
5. **Photos and files** — R2-backed attachments on topics and replies, served through an access-controlled endpoint (`api/attachments/[id].ts`) that re-checks category permissions before streaming the file.
6. **Visual theme** — shared `Layout.astro` + `global.css`, built from the real OYC logo and site colors (`#00569b` blue, `#ea243f` red).

## Admin control panel

All admin pages live under `/admin/*` and redirect non-admins to `/`. All admin-only API routes live under `/api/admin/*` and return 403 for non-admins.

- **`/admin/members`** — approve pending member signups. The home page nav only shows this link (with a live count) when at least one approval is pending.
- **`/admin/categories`** — enable/disable each category, and edit its description inline.
- **`/admin/users`** — view every user's approval status, edit their name/mobile number, change their role (an admin can't change their own role, to avoid self-lockout), and see which groups they belong to.
- **`/admin/groups`** — create groups, add/remove members per group. A group can't be deleted while it still has members (enforced both in the UI and server-side); removing a member or deleting a group asks for confirmation first.

## Known constraints

- D1 doesn't support `RETURNING`; inserts use `result.meta.last_row_id` to get the new row's id.
- Category and role checks are re-verified server-side on every read/write endpoint, not just in the UI, since URLs can be hit directly.
