import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";

export const POST: APIRoute = async ({ request, redirect }) => {
  const formData = await request.formData();
  const email = String(formData.get("email") || "")
    .trim()
    .toLowerCase();

  if (!email || !email.includes("@")) {
    return redirect("/login?error=invalid");
  }

  const token = crypto.randomUUID();

  await env.DB
    .prepare(
      `INSERT INTO login_tokens (email, token, expires_at)
       VALUES (?, ?, datetime('now', '+60 minutes'))`
    )
    .bind(email, token)
    .run();

  const origin = new URL(request.url).origin;
  const link = `${origin}/api/verify?token=${token}`;
  const fromAddress = env.RESEND_FROM_EMAIL || "onboarding@resend.dev";

  try {
    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromAddress,
        to: [email],
        subject: "Your OYC Forum login link",
        html: `<p>Click the link below to log in to the OYC Forum:</p><p><a href="${link}">${link}</a></p><p>This link expires in 60 minutes. If you didn't request this, you can ignore this email.</p>`,
      }),
    });

    if (!emailResponse.ok) {
      console.error("Resend error:", await emailResponse.text());
    }
  } catch (err) {
    console.error("Failed to send login email:", err);
  }

  return redirect("/login?sent=1");
};
