import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { canAccessCategory } from "../../lib/roles";

export const POST: APIRoute = async ({ request, redirect, locals }) => {
  const user = locals.user;

  if (!user || !user.approved) {
    return new Response("You must be logged in and approved to post.", {
      status: 403,
    });
  }

  const formData = await request.formData();
  const categoryId = formData.get("category_id");
  const title = String(formData.get("title") || "").trim();
  const content = String(formData.get("content") || "").trim();
  const topicTypeRaw = formData.get("topic_type");
  const topicType = topicTypeRaw ? String(topicTypeRaw).trim() : null;

  if (!categoryId || !title || !content) {
    return new Response("Category, title, and message are required.", {
      status: 400,
    });
  }

  const category = await env.DB
    .prepare(`SELECT id, minimum_role, enabled FROM categories WHERE id = ?`)
    .bind(categoryId)
    .first();

  if (!category || !canAccessCategory(user.role, category.minimum_role)) {
    return new Response("You don't have access to post in this category.", {
      status: 403,
    });
  }

  if (!category.enabled) {
    return new Response("This category is currently disabled.", { status: 403 });
  }

  const attachment = formData.get("attachment");

  const topicInsert = await env.DB
    .prepare(
      `INSERT INTO topics (category_id, author_id, title, topic_type) VALUES (?, ?, ?, ?)`
    )
    .bind(categoryId, user.id, title, topicType)
    .run();

  const topicId = topicInsert.meta.last_row_id;

  const postInsert = await env.DB
    .prepare(`INSERT INTO posts (topic_id, author_id, content) VALUES (?, ?, ?)`)
    .bind(topicId, user.id, content)
    .run();

  const postId = postInsert.meta.last_row_id;

  if (attachment instanceof File && attachment.size > 0) {
    const key = `attachments/${crypto.randomUUID()}-${attachment.name}`;

    await env.ATTACHMENTS.put(key, attachment.stream(), {
      httpMetadata: { contentType: attachment.type || "application/octet-stream" },
    });

    await env.DB
      .prepare(
        `INSERT INTO attachments (post_id, r2_key, filename, content_type, size, uploaded_by)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .bind(postId, key, attachment.name, attachment.type, attachment.size, user.id)
      .run();
  }

  return redirect(`/topic/${topicId}`);
};
