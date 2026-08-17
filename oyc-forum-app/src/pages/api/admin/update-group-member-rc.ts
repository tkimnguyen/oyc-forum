import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";

const VALID_RC_ROLES = ["judge", "boat2"];

export const POST: APIRoute = async ({ request, redirect, locals }) => {
  const user = locals.user;

  if (!user || user.role !== "admin") {
    return new Response("Forbidden", { status: 403 });
  }

  const formData = await request.formData();
  const groupId = formData.get("group_id");
  const userId = formData.get("user_id");
  const rcRoleRaw = String(formData.get("rc_role") || "").trim().toLowerCase();
  const rcRole = VALID_RC_ROLES.includes(rcRoleRaw) ? rcRoleRaw : null;

  if (!groupId || !userId) {
    return new Response("Missing group_id or user_id", { status: 400 });
  }

  await env.DB
    .prepare(`UPDATE user_groups SET rc_role = ? WHERE user_id = ? AND group_id = ?`)
    .bind(rcRole, userId, groupId)
    .run();

  return redirect("/admin/groups");
};
