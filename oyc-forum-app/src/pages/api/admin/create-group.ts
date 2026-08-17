import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";

export const POST: APIRoute = async ({ request, redirect, locals }) => {
  const user = locals.user;

  if (!user || user.role !== "admin") {
    return new Response("Forbidden", { status: 403 });
  }

  const formData = await request.formData();
  const name = String(formData.get("name") || "").trim();
  const description = String(formData.get("description") || "").trim();

  if (!name) {
    return new Response("Group name is required.", { status: 400 });
  }

  await env.DB
    .prepare(`INSERT OR IGNORE INTO groups (name, description) VALUES (?, ?)`)
    .bind(name, description || null)
    .run();

  return redirect("/admin/groups");
};
