import { env } from "cloudflare:workers";

// Sends SMS via Twilio's REST API. No-ops (with a log line) when Twilio
// credentials aren't configured, and never throws, so a missing/failed
// provider never blocks the caller's own request.
export async function sendSms(to: string, body: string): Promise<void> {
  const accountSid = env.TWILIO_ACCOUNT_SID;
  const authToken = env.TWILIO_AUTH_TOKEN;
  const fromNumber = env.TWILIO_FROM_NUMBER;

  if (!accountSid || !authToken || !fromNumber) {
    console.log("SMS not sent (Twilio not configured):", to, body);
    return;
  }

  try {
    const credentials = btoa(`${accountSid}:${authToken}`);

    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${credentials}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({ To: to, From: fromNumber, Body: body }),
      }
    );

    if (!response.ok) {
      console.log("Twilio send failed:", response.status, await response.text());
    }
  } catch (err) {
    console.log("Twilio send threw:", to, err);
  }
}
