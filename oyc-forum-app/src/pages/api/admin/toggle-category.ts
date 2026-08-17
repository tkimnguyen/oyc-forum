import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";

export const POST: APIRoute = async ({ request, redirect, locals }) => {
  const user = locals.user;

  if (!user || user.role !== "admin") {
    return new Response("Forbidden", { status: 403 });
  }

  const formData = await request.formData();
  const categoryId = formData.get("category_id");
  const enabledRaw = formData.get("enabled");

  if (!categoryId || enabledRaw === null) {
    return new Response("Missing category_id or enabled", { status: 400 });
  }

  const enabled = enabledRaw === "1" ? 1 : 0;

  await env.DB
    .prepare(`UPDATE categories SET enabled = ? WHERE id = ?`)
    .bind(enabled, categoryId)
    .run();

  return redirect("/admin/categories");
};
