import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";

export const POST: APIRoute = async ({ request, redirect, locals }) => {
  const user = locals.user;

  if (!user) {
    return new Response("You must be logged in.", { status: 403 });
  }

  const formData = await request.formData();
  const name = String(formData.get("name") || "").trim();
  const phone = String(formData.get("phone") || "").trim();
  const notifyGroupEmail = formData.get("notify_group_email") ? 1 : 0;
  const notifyGroupSms = formData.get("notify_group_sms") ? 1 : 0;
  const notifyRepliesEmail = formData.get("notify_replies_email") ? 1 : 0;
  const notifyRepliesSms = formData.get("notify_replies_sms") ? 1 : 0;

  await env.DB
    .prepare(
      `UPDATE users SET name = ?, phone = ?, notify_group_email = ?, notify_group_sms = ?,
       notify_replies_email = ?, notify_replies_sms = ? WHERE id = ?`
    )
    .bind(
      name || null,
      phone || null,
      notifyGroupEmail,
      notifyGroupSms,
      notifyRepliesEmail,
      notifyRepliesSms,
      user.id
    )
    .run();

  return redirect("/profile?saved=1");
};
