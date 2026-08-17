import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";

export const POST: APIRoute = async ({ request, redirect, locals }) => {
  const user = locals.user;

  if (!user || user.role !== "admin") {
    return new Response("Forbidden", { status: 403 });
  }

  const formData = await request.formData();
  const categoryId = formData.get("category_id");
  const description = String(formData.get("description") || "").trim();

  if (!categoryId) {
    return new Response("Missing category_id", { status: 400 });
  }

  await env.DB
    .prepare(`UPDATE categories SET description = ? WHERE id = ?`)
    .bind(description || null, categoryId)
    .run();

  return redirect("/admin/categories");
};
