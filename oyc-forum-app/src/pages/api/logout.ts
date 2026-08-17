import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";

export const POST: APIRoute = async ({ cookies, redirect }) => {
  const token = cookies.get("session_token")?.value;

  if (token) {
    await env.DB.prepare(`DELETE FROM sessions WHERE token = ?`).bind(token).run();
  }

  cookies.delete("session_token", { path: "/" });

  return redirect("/");
};
