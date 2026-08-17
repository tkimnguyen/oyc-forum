import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";

export const POST: APIRoute = async ({ request, redirect, locals }) => {
  const user = locals.user;

  if (!user || user.role !== "admin") {
    return new Response("Forbidden", { status: 403 });
  }

  const formData = await request.formData();
  const userId = formData.get("user_id");
  const name = String(formData.get("name") || "").trim();
  const phone = String(formData.get("phone") || "").trim();

  if (!userId) {
    return new Response("Missing user_id", { status: 400 });
  }

  await env.DB
    .prepare(`UPDATE users SET name = ?, phone = ? WHERE id = ?`)
    .bind(name || null, phone || null, userId)
    .run();

  return redirect("/admin/users");
};
