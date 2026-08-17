import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { toCsvRow } from "../../../lib/csv";

export const GET: APIRoute = async ({ locals }) => {
  const user = locals.user;

  if (!user || user.role !== "admin") {
    return new Response("Forbidden", { status: 403 });
  }

  const result = await env.DB
    .prepare(`
      SELECT id, email, name, phone, role, approved,
        notify_group_email, notify_group_sms, notify_replies_email, notify_replies_sms
      FROM users ORDER BY email
    `)
    .all();

  const rows = result.results || [];

  const membershipsResult = await env.DB
    .prepare(`
      SELECT user_groups.user_id, groups.name AS group_name, user_groups.rc_role
      FROM user_groups
      JOIN groups ON groups.id = user_groups.group_id
      ORDER BY groups.name
    `)
    .all();

  const groupsByUser: Record<number, string[]> = {};
  for (const membership of membershipsResult.results || []) {
    const userId = membership.user_id as number;
    if (!groupsByUser[userId]) groupsByUser[userId] = [];
    const rcSuffix = membership.rc_role ? `:${membership.rc_role}` : "";
    groupsByUser[userId].push(`${membership.group_name as string}${rcSuffix}`);
  }

  const lines = [
    toCsvRow([
      "email",
      "name",
      "phone",
      "role",
      "approved",
      "groups",
      "notify_group_email",
      "notify_group_sms",
      "notify_replies_email",
      "notify_replies_sms",
    ]),
  ];

  for (const row of rows) {
    const groups = (groupsByUser[row.id as number] || []).join(";");
    lines.push(
      toCsvRow([
        row.email as string,
        row.name as string,
        row.phone as string,
        row.role as string,
        row.approved as number,
        groups,
        row.notify_group_email as number,
        row.notify_group_sms as number,
        row.notify_replies_email as number,
        row.notify_replies_sms as number,
      ])
    );
  }

  const csv = lines.join("\r\n") + "\r\n";

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="oyc-forum-users.csv"`,
    },
  });
};
