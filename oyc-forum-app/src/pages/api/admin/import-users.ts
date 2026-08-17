import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { parseCsv } from "../../../lib/csv";

const VALID_ROLES = ["member", "moderator", "board", "admin"];
const VALID_RC_ROLES = ["judge", "boat2"];

function truthy(value: string | undefined): boolean {
  const normalized = (value || "").trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes";
}

export const POST: APIRoute = async ({ request, redirect, locals }) => {
  const user = locals.user;

  if (!user || user.role !== "admin") {
    return new Response("Forbidden", { status: 403 });
  }

  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File) || file.size === 0) {
    return new Response("Please choose a CSV file to import.", { status: 400 });
  }

  const text = await file.text();
  const rows = parseCsv(text);

  if (rows.length === 0) {
    return redirect("/admin/users?imported=0&updated=0&skipped=0");
  }

  const header = rows[0].map((cell) => cell.trim().toLowerCase());
  const emailIdx = header.indexOf("email");

  if (emailIdx === -1) {
    return new Response('The CSV must have an "email" column header.', { status: 400 });
  }

  // Column-aware: a column that's absent from the header is left untouched
  // for existing users (rather than silently wiped back to blank/default).
  const colIdx = {
    name: header.indexOf("name"),
    phone: header.indexOf("phone"),
    role: header.indexOf("role"),
    approved: header.indexOf("approved"),
    groups: header.indexOf("groups"),
    notifyGroupEmail: header.indexOf("notify_group_email"),
    notifyGroupSms: header.indexOf("notify_group_sms"),
    notifyRepliesEmail: header.indexOf("notify_replies_email"),
    notifyRepliesSms: header.indexOf("notify_replies_sms"),
  };

  const groupIdCache = new Map<string, number>();

  async function getOrCreateGroupId(name: string): Promise<number> {
    const cached = groupIdCache.get(name.toLowerCase());
    if (cached !== undefined) return cached;

    const existingGroup = await env.DB
      .prepare(`SELECT id FROM groups WHERE name = ?`)
      .bind(name)
      .first();

    let groupId: number;

    if (existingGroup) {
      groupId = existingGroup.id as number;
    } else {
      const inserted = await env.DB
        .prepare(`INSERT INTO groups (name) VALUES (?)`)
        .bind(name)
        .run();
      groupId = inserted.meta.last_row_id as number;
    }

    groupIdCache.set(name.toLowerCase(), groupId);
    return groupId;
  }

  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const row of rows.slice(1)) {
    const email = (row[emailIdx] || "").trim();

    if (!email) {
      skipped++;
      continue;
    }

    const existing = await env.DB
      .prepare(`SELECT id FROM users WHERE email = ?`)
      .bind(email)
      .first();

    let userId: number;

    if (existing) {
      userId = existing.id as number;

      const setClauses: string[] = [];
      const values: (string | number | null)[] = [];

      if (colIdx.name !== -1) {
        setClauses.push("name = ?");
        values.push((row[colIdx.name] || "").trim() || null);
      }
      if (colIdx.phone !== -1) {
        setClauses.push("phone = ?");
        values.push((row[colIdx.phone] || "").trim() || null);
      }
      if (colIdx.role !== -1) {
        const roleRaw = (row[colIdx.role] || "").trim().toLowerCase();
        setClauses.push("role = ?");
        values.push(VALID_ROLES.includes(roleRaw) ? roleRaw : "member");
      }
      if (colIdx.approved !== -1) {
        setClauses.push("approved = ?");
        values.push(truthy(row[colIdx.approved]) ? 1 : 0);
      }
      if (colIdx.notifyGroupEmail !== -1) {
        setClauses.push("notify_group_email = ?");
        values.push(truthy(row[colIdx.notifyGroupEmail]) ? 1 : 0);
      }
      if (colIdx.notifyGroupSms !== -1) {
        setClauses.push("notify_group_sms = ?");
        values.push(truthy(row[colIdx.notifyGroupSms]) ? 1 : 0);
      }
      if (colIdx.notifyRepliesEmail !== -1) {
        setClauses.push("notify_replies_email = ?");
        values.push(truthy(row[colIdx.notifyRepliesEmail]) ? 1 : 0);
      }
      if (colIdx.notifyRepliesSms !== -1) {
        setClauses.push("notify_replies_sms = ?");
        values.push(truthy(row[colIdx.notifyRepliesSms]) ? 1 : 0);
      }

      if (setClauses.length > 0) {
        await env.DB
          .prepare(`UPDATE users SET ${setClauses.join(", ")} WHERE id = ?`)
          .bind(...values, userId)
          .run();
      }

      updated++;
    } else {
      const name = colIdx.name !== -1 ? (row[colIdx.name] || "").trim() || null : null;
      const phone = colIdx.phone !== -1 ? (row[colIdx.phone] || "").trim() || null : null;
      const roleRaw = colIdx.role !== -1 ? (row[colIdx.role] || "").trim().toLowerCase() : "";
      const role = VALID_ROLES.includes(roleRaw) ? roleRaw : "member";
      const approved = colIdx.approved !== -1 ? (truthy(row[colIdx.approved]) ? 1 : 0) : 0;
      const notifyGroupEmail =
        colIdx.notifyGroupEmail !== -1 ? (truthy(row[colIdx.notifyGroupEmail]) ? 1 : 0) : 1;
      const notifyGroupSms =
        colIdx.notifyGroupSms !== -1 ? (truthy(row[colIdx.notifyGroupSms]) ? 1 : 0) : 1;
      const notifyRepliesEmail =
        colIdx.notifyRepliesEmail !== -1 ? (truthy(row[colIdx.notifyRepliesEmail]) ? 1 : 0) : 1;
      const notifyRepliesSms =
        colIdx.notifyRepliesSms !== -1 ? (truthy(row[colIdx.notifyRepliesSms]) ? 1 : 0) : 1;

      const inserted = await env.DB
        .prepare(
          `INSERT INTO users
            (email, name, phone, role, approved, notify_group_email, notify_group_sms, notify_replies_email, notify_replies_sms)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          email,
          name,
          phone,
          role,
          approved,
          notifyGroupEmail,
          notifyGroupSms,
          notifyRepliesEmail,
          notifyRepliesSms
        )
        .run();
      userId = inserted.meta.last_row_id as number;
      created++;
    }

    if (colIdx.groups !== -1) {
      const groupEntries = (row[colIdx.groups] || "")
        .split(";")
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0);

      await env.DB.prepare(`DELETE FROM user_groups WHERE user_id = ?`).bind(userId).run();

      for (const entry of groupEntries) {
        // Each entry is "Group Name" or "Group Name:rc_role" (rc_role is "judge" or "boat2").
        const [groupNamePart, rcRolePart] = entry.split(":");
        const groupName = groupNamePart.trim();
        if (!groupName) continue;

        const rcRoleRaw = (rcRolePart || "").trim().toLowerCase();
        const rcRole = VALID_RC_ROLES.includes(rcRoleRaw) ? rcRoleRaw : null;

        const groupId = await getOrCreateGroupId(groupName);
        await env.DB
          .prepare(`INSERT OR IGNORE INTO user_groups (user_id, group_id, rc_role) VALUES (?, ?, ?)`)
          .bind(userId, groupId, rcRole)
          .run();
      }
    }
  }

  return redirect(`/admin/users?imported=${created}&updated=${updated}&skipped=${skipped}`);
};
