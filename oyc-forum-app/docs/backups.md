# Backups

The forum has two layers of backup protection.

## Layer 1: D1 Time Travel (automatic, no setup)

Cloudflare D1 automatically keeps a 30-day point-in-time recovery log for
every database — this requires no configuration and is already active.
To restore the live database to any point in the last 30 days:

```
npx wrangler d1 time-travel restore oyc-forum-db --timestamp=<ISO-8601 timestamp>
```

or restore to just before a specific bookmark/migration:

```
npx wrangler d1 time-travel info oyc-forum-db
```

This covers "someone deleted the wrong row" or "a bad migration ran" — but
it only reaches back 30 days and only lives inside Cloudflare's own systems.

## Layer 2: Scheduled offsite backup (GitHub Actions)

`.github/workflows/backup.yml` runs once a day (08:00 UTC, adjustable via
the `cron` line) and:

1. Exports the full D1 database to a `.sql` file via `wrangler d1 export --remote`
2. Syncs every object in the `oyc-forum-attachments` R2 bucket down via `rclone`
3. Packages both into a single `.tar.gz`
4. Uploads that as a GitHub Actions artifact, kept for 90 days

You can also trigger it manually any time from the repo's **Actions** tab
("Scheduled Backup" → **Run workflow**), and download the resulting archive
from that run's page under **Artifacts**.

### One-time setup: required secrets

Add these under the repo's **Settings → Secrets and variables → Actions**:

| Secret | Where to get it |
|---|---|
| `CLOUDFLARE_API_TOKEN` | Cloudflare dashboard → My Profile → API Tokens → Create Token, with **Account → D1 → Edit** permission scoped to this account |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare dashboard sidebar, or `npx wrangler whoami` |
| `R2_ACCESS_KEY_ID` | Cloudflare dashboard → R2 → Manage R2 API Tokens → Create API Token (Object **Read** is enough for backups), scoped to the `oyc-forum-attachments` bucket |
| `R2_SECRET_ACCESS_KEY` | Shown once when you create the R2 API token above — save it immediately |

None of these tokens need write access to anything other than reading D1 and
reading R2 — keep them scoped as narrowly as possible.

### Restoring from a backup archive

Download and extract the artifact, then:

```
tar -xzf oyc-forum-backup-<date>.tar.gz
```

To restore the database (**this overwrites the live database** — test
against `--local` first if you're not sure):

```
npx wrangler d1 execute oyc-forum-db --local --file=backup/db-<date>.sql
# once verified, repeat with --remote to restore production
```

To restore attachments back into R2:

```
rclone sync backup/attachments r2:oyc-forum-attachments
```

(using the same `rclone` config environment variables described above).

### Backup history and manual trigger, from the app itself

`/admin/storage` (Storage & Stats) lists recent runs of the backup workflow
and has a **Backup Now** button, so admins don't need to visit GitHub at all
for routine use. This calls the GitHub Actions REST API directly from the
Worker, and needs its own credential — separate from the secrets above,
which only exist inside the GitHub Actions runner:

| Worker secret/var | Value |
|---|---|
| `GITHUB_TOKEN` | A classic personal access token with the **repo** scope (or a fine-grained token with **Actions: Read and write** on this repo) |
| `GITHUB_REPO` | `owner/repo`, e.g. `kimnguyen/oyc-forum` |
| `GITHUB_BRANCH` | Optional — branch to dispatch the workflow on. Defaults to `main` |

Set these with `wrangler secret put GITHUB_TOKEN` (and similarly for the
others, or as plain vars in `wrangler.jsonc` if you don't consider the repo
name/branch sensitive) so they're available to the deployed Worker. Locally,
add them to `.dev.vars` the same way as the Resend/Twilio keys.

If these aren't set, the Backups card on `/admin/storage` just says so —
the rest of the page still works.

### Why GitHub Actions instead of a Cloudflare Worker Cron Trigger

A Worker Cron Trigger can't shell out to `wrangler` or `rclone` — it would
need custom code to query every table and write JSON/CSV via the D1 client,
and R2-to-R2 replication logic written by hand. GitHub Actions gets to reuse
the same CLI tools you already use locally, at the cost of needing API
credentials stored as repo secrets instead of Worker bindings.
