import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";

export const GET: APIRoute = async ({ url, cookies, redirect }) => {
  const token = url.searchParams.get("token");

  if (!token) {
    return redirect("/login?error=invalid");
  }

  const loginToken = await env.DB
    .prepare(
      `SELECT id, email FROM login_tokens
       WHERE token = ? AND used_at IS NULL AND expires_at > CURRENT_TIMESTAMP`
    )
    .bind(token)
    .first();

  if (!loginToken) {
    return redirect("/login?error=invalid");
  }

  await env.DB
    .prepare(`UPDATE login_tokens SET used_at = CURRENT_TIMESTAMP WHERE id = ?`)
    .bind(loginToken.id)
    .run();

  let user = await env.DB
    .prepare(`SELECT id, approved FROM users WHERE email = ?`)
    .bind(loginToken.email)
    .first();

  if (!user) {
    const insert = await env.DB
      .prepare(`INSERT INTO users (email, role, approved) VALUES (?, 'member', 0)`)
      .bind(loginToken.email)
      .run();

    user = { id: insert.meta.last_row_id, approved: 0 };
  }

  const sessionToken = crypto.randomUUID();

  await env.DB
    .prepare(
      `INSERT INTO sessions (user_id, token, expires_at)
       VALUES (?, ?, datetime('now', '+30 days'))`
    )
    .bind(user.id, sessionToken)
    .run();

  cookies.set("session_token", sessionToken, {
    path: "/",
    httpOnly: true,
    secure: url.protocol === "https:",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30,
  });

  return redirect(user.approved ? "/" : "/pending-approval");
};
