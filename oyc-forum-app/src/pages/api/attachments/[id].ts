import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { canAccessCategory } from "../../../lib/roles";

export const GET: APIRoute = async ({ params, locals }) => {
  const user = locals.user;
  const id = params.id;

  const attachment = await env.DB
    .prepare(`
      SELECT
        attachments.r2_key,
        attachments.filename,
        attachments.content_type,
        categories.minimum_role
      FROM attachments
      JOIN posts ON posts.id = attachments.post_id
      JOIN topics ON topics.id = posts.topic_id
      JOIN categories ON categories.id = topics.category_id
      WHERE attachments.id = ?
    `)
    .bind(id)
    .first();

  if (!attachment || !canAccessCategory(user?.role, attachment.minimum_role)) {
    return new Response("Not found", { status: 404 });
  }

  const object = await env.ATTACHMENTS.get(attachment.r2_key);

  if (!object) {
    return new Response("Not found", { status: 404 });
  }

  return new Response(object.body, {
    headers: {
      "Content-Type": attachment.content_type || "application/octet-stream",
      "Content-Disposition": `inline; filename="${attachment.filename}"`,
      "Cache-Control": "private, max-age=3600",
    },
  });
};
