import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { canAccessCategory } from "../../lib/roles";
import { sendEmail } from "../../lib/email";
import { sendSms } from "../../lib/sms";

export const POST: APIRoute = async ({ request, redirect, locals }) => {
  const user = locals.user;

  if (!user || !user.approved) {
    return new Response("You must be logged in and approved to post.", {
      status: 403,
    });
  }

  const formData = await request.formData();
  const topicId = formData.get("topic_id");
  const content = String(formData.get("content") || "").trim();

  if (!topicId || !content) {
    return new Response("A message is required.", { status: 400 });
  }

  const topic = await env.DB
    .prepare(`
      SELECT topics.id, topics.title, topics.author_id, categories.minimum_role
      FROM topics
      JOIN categories ON categories.id = topics.category_id
      WHERE topics.id = ?
    `)
    .bind(topicId)
    .first();

  if (!topic || !canAccessCategory(user.role, topic.minimum_role)) {
    return new Response("You don't have access to reply in this topic.", {
      status: 403,
    });
  }

  const attachment = formData.get("attachment");

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

  const participantsResult = await env.DB
    .prepare(`
      SELECT DISTINCT users.id, users.email, users.phone, users.notify_replies_email, users.notify_replies_sms
      FROM posts
      JOIN users ON users.id = posts.author_id
      WHERE posts.topic_id = ?

      UNION

      SELECT users.id, users.email, users.phone, users.notify_replies_email, users.notify_replies_sms
      FROM topics
      JOIN users ON users.id = topics.author_id
      WHERE topics.id = ?
    `)
    .bind(topicId, topicId)
    .all();

  const participants = participantsResult.results || [];
  const replierName = user.name || user.email;
  const origin = new URL(request.url).origin;
  const topicLink = `${origin}/topic/${topicId}`;
  const subject = `New reply in "${topic.title as string}"`;
  const emailBody = `${replierName} replied to "${topic.title}":\n\n${content}\n\n${topicLink}`;
  const smsBody = `[${topic.title as string}] ${replierName}: ${content}`.slice(0, 300);

  for (const participant of participants) {
    if (participant.id === user.id) continue;

    if (participant.notify_replies_email) {
      await sendEmail(participant.email as string, subject, emailBody);
    }

    if (participant.notify_replies_sms && participant.phone) {
      await sendSms(participant.phone as string, smsBody);
    }
  }

  return redirect(`/topic/${topicId}`);
};
