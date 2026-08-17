import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";

const VALID_ROLES = ["member", "moderator", "board", "admin"];

export const POST: APIRoute = async ({ request, redirect, locals }) => {
  const user = locals.user;

  if (!user || user.role !== "admin") {
    return new Response("Forbidden", { status: 403 });
  }

  const formData = await request.formData();
  const userId = formData.get("user_id");
  const role = formData.get("role");

  if (!userId || typeof role !== "string" || !VALID_ROLES.includes(role)) {
    return new Response("Missing or invalid user_id/role", { status: 400 });
  }

  if (Number(userId) === user.id) {
    return new Response("You can't change your own role.", { status: 400 });
  }

  await env.DB
    .prepare(`UPDATE users SET role = ? WHERE id = ?`)
    .bind(role, userId)
    .run();

  return redirect("/admin/users");
};
