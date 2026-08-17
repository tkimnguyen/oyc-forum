import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { sendEmail } from "../../../lib/email";
import { sendSms } from "../../../lib/sms";

export const POST: APIRoute = async ({ request, redirect, locals }) => {
  const user = locals.user;

  if (!user || !user.approved) {
    return new Response("You must be logged in and approved to post.", { status: 403 });
  }

  const formData = await request.formData();
  const groupId = formData.get("group_id");
  const content = String(formData.get("content") || "").trim();
  const includeRc = formData.get("include_rc") === "1";

  if (!groupId || !content) {
    return new Response("Message content is required.", { status: 400 });
  }

  const group = await env.DB
    .prepare(`SELECT id, name FROM groups WHERE id = ?`)
    .bind(groupId)
    .first();

  if (!group) {
    return new Response("Group not found.", { status: 404 });
  }

  const membership = await env.DB
    .prepare(`SELECT 1 FROM user_groups WHERE user_id = ? AND group_id = ?`)
    .bind(user.id, groupId)
    .first();

  if (!membership && user.role !== "admin") {
    return new Response("You must be a member of this group to post.", { status: 403 });
  }

  await env.DB
    .prepare(`INSERT INTO group_messages (group_id, author_id, content) VALUES (?, ?, ?)`)
    .bind(groupId, user.id, content)
    .run();

  const membersResult = await env.DB
    .prepare(`
      SELECT
        users.id, users.email, users.phone, users.notify_group_email, users.notify_group_sms,
        user_groups.rc_role
      FROM user_groups
      JOIN users ON users.id = user_groups.user_id
      WHERE user_groups.group_id = ?
    `)
    .bind(groupId)
    .all();

  const members = membersResult.results || [];
  const senderName = user.name || user.email;
  const subject = `[${group.name as string}] New message from ${senderName}`;
  const smsBody = `[${group.name as string}] ${senderName}: ${content}`.slice(0, 300);

  for (const member of members) {
    if (member.id === user.id) continue;

    // RC members (judge/boat 2) are excluded from notifications unless the
    // sender explicitly checks "Include RC members".
    if (member.rc_role && !includeRc) continue;

    if (member.notify_group_email) {
      await sendEmail(member.email as string, subject, content);
    }

    if (member.notify_group_sms && member.phone) {
      await sendSms(member.phone as string, smsBody);
    }
  }

  return redirect(`/groups/${groupId}`);
};
