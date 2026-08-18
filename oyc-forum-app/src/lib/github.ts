import { env } from "cloudflare:workers";

// Talks to the GitHub Actions REST API to surface and trigger runs of the
// scheduled backup workflow (.github/workflows/backup.yml). Requires a
// GITHUB_TOKEN (classic PAT with "repo" scope, or a fine-grained token with
// Actions: Read and write) and GITHUB_REPO (e.g. "yourname/oyc-forum") set
// as Worker secrets/vars. Both are optional — if either is missing, callers
// get back a clear error instead of a crash.

const WORKFLOW_FILE = "backup.yml";

export type BackupRun = {
  id: number;
  runNumber: number;
  status: string;
  conclusion: string | null;
  createdAt: string;
  htmlUrl: string;
};

function isConfigured(): boolean {
  return Boolean(env.GITHUB_TOKEN && env.GITHUB_REPO);
}

function githubHeaders(): HeadersInit {
  return {
    Authorization: `Bearer ${env.GITHUB_TOKEN}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "oyc-forum",
  };
}

export async function listBackupRuns(
  limit = 15
): Promise<{ runs: BackupRun[]; error: string | null }> {
  if (!isConfigured()) {
    return {
      runs: [],
      error:
        "Not configured — set the GITHUB_TOKEN and GITHUB_REPO Worker secrets to see backup history here.",
    };
  }

  try {
    const url = `https://api.github.com/repos/${env.GITHUB_REPO}/actions/workflows/${WORKFLOW_FILE}/runs?per_page=${limit}`;
    const response = await fetch(url, { headers: githubHeaders() });

    if (!response.ok) {
      return { runs: [], error: `GitHub API returned ${response.status} while listing runs.` };
    }

    const data = (await response.json()) as {
      workflow_runs?: Array<{
        id: number;
        run_number: number;
        status: string;
        conclusion: string | null;
        created_at: string;
        html_url: string;
      }>;
    };

    const runs = (data.workflow_runs || []).map((run) => ({
      id: run.id,
      runNumber: run.run_number,
      status: run.status,
      conclusion: run.conclusion,
      createdAt: run.created_at,
      htmlUrl: run.html_url,
    }));

    return { runs, error: null };
  } catch {
    return { runs: [], error: "Could not reach the GitHub API." };
  }
}

export async function triggerBackupRun(): Promise<{ ok: boolean; error: string | null }> {
  if (!isConfigured()) {
    return {
      ok: false,
      error:
        "Not configured — set the GITHUB_TOKEN and GITHUB_REPO Worker secrets before triggering backups from here.",
    };
  }

  try {
    const url = `https://api.github.com/repos/${env.GITHUB_REPO}/actions/workflows/${WORKFLOW_FILE}/dispatches`;
    const response = await fetch(url, {
      method: "POST",
      headers: { ...githubHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({ ref: env.GITHUB_BRANCH || "main" }),
    });

    if (!response.ok) {
      const text = await response.text();
      return { ok: false, error: `GitHub API returned ${response.status}: ${text.slice(0, 200)}` };
    }

    return { ok: true, error: null };
  } catch {
    return { ok: false, error: "Could not reach the GitHub API." };
  }
}
