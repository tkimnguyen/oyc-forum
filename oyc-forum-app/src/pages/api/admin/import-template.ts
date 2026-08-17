import type { APIRoute } from "astro";
import { toCsvRow } from "../../../lib/csv";

export const GET: APIRoute = async ({ locals }) => {
  const user = locals.user;

  if (!user || user.role !== "admin") {
    return new Response("Forbidden", { status: 403 });
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
    toCsvRow([
      "jane@example.com",
      "Jane Doe",
      "555-123-4567",
      "member",
      "1",
      "E Boat;Laser:judge",
      "1",
      "1",
      "1",
      "0",
    ]),
  ];

  const csv = lines.join("\r\n") + "\r\n";

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="oyc-forum-users-template.csv"`,
    },
  });
};
