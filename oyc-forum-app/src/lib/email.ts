import { env } from "cloudflare:workers";

// Fire-and-forget-ish email helper. Never throws — logs and returns instead,
// so a failed/missing provider never blocks the caller's own request (e.g.
// posting a group message should succeed even if notification email fails).
export async function sendEmail(to: string, subject: string, text: string): Promise<void> {
  if (!env.RESEND_API_KEY) {
    console.log("Email not sent (RESEND_API_KEY not configured):", to, subject);
    return;
  }

  const fromAddress = env.RESEND_FROM_EMAIL || "onboarding@resend.dev";

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromAddress,
        to: [to],
        subject,
        text,
      }),
    });

    if (!response.ok) {
      console.log("Resend send failed:", response.status, await response.text());
    }
  } catch (err) {
    console.log("Resend send threw:", to, err);
  }
}
