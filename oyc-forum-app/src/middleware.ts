import { defineMiddleware } from "astro:middleware";
import { env } from "cloudflare:workers";

export const onRequest = defineMiddleware(async (context, next) => {
  context.locals.user = null;

  const token = context.cookies.get("session_token")?.value;

  if (token) {
    const user = await env.DB
      .prepare(
        `SELECT users.id, users.email, users.name, users.role, users.approved
         FROM sessions
         JOIN users ON users.id = sessions.user_id
         WHERE sessions.token = ? AND sessions.expires_at > CURRENT_TIMESTAMP`
      )
      .bind(token)
      .first();

    context.locals.user = user || null;
  }

  return next();
});
