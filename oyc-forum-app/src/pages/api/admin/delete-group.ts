import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";

export const POST: APIRoute = async ({ request, redirect, locals }) => {
  const user = locals.user;

  if (!user || user.role !== "admin") {
    return new Response("Forbidden", { status: 403 });
  }

  const formData = await request.formData();
  const groupId = formData.get("group_id");

  if (!groupId) {
    return new Response("Missing group_id", { status: 400 });
  }

  const memberCount = await env.DB
    .prepare(`SELECT COUNT(*) AS count FROM user_groups WHERE group_id = ?`)
    .bind(groupId)
    .first();

  if ((memberCount?.count ?? 0) > 0) {
    return new Response(
      "This group still has members. Remove them all before deleting the group.",
      { status: 400 }
    );
  }

  await env.DB.prepare(`DELETE FROM groups WHERE id = ?`).bind(groupId).run();

  return redirect("/admin/groups");
};
