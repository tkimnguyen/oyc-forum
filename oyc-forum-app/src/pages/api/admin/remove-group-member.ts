import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";

export const POST: APIRoute = async ({ request, redirect, locals }) => {
  const user = locals.user;

  if (!user || user.role !== "admin") {
    return new Response("Forbidden", { status: 403 });
  }

  const formData = await request.formData();
  const groupId = formData.get("group_id");
  const userId = formData.get("user_id");

  if (!groupId || !userId) {
    return new Response("Missing group_id or user_id", { status: 400 });
  }

  await env.DB
    .prepare(`DELETE FROM user_groups WHERE user_id = ? AND group_id = ?`)
    .bind(userId, groupId)
    .run();

  return redirect("/admin/groups");
};
