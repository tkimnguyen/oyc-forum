# Calendar

`/calendar` shows the next 90 days of events from a Google Calendar, read
directly from its public `.ics` feed — no Google Cloud project, API key,
or OAuth consent screen required.

## How it works

Google publishes a read-only iCalendar feed for any calendar that has
**"Make available to public"** turned on, at:

```
https://calendar.google.com/calendar/ical/<calendar-id>/public/basic.ics
```

`src/lib/calendar.ts` fetches that URL on every page load, parses it with
[`ical.js`](https://github.com/kewisch/ical.js), and expands recurring
events (e.g. "Wednesday Night Racing, every week") into individual
occurrences within the next 90 days. One-off changes to a single occurrence
— a `RECURRENCE-ID` override, like "this week's race moved indoors" — are
matched up to the right date and shown in place of the regular recurrence,
not as a duplicate event.

There's a safety cap of 60 occurrences per recurring series, so a
pathological recurrence rule (daily, no end date) can't turn a page load
into an unbounded loop.

## Pointing it at a different calendar

By default it reads the club's shared events calendar
(`j0n9v98vs612ojg04bfinil068@group.calendar.google.com`). To use a
different one:

1. In Google Calendar, open the target calendar's **Settings and sharing**.
2. Under **Access permissions**, check **"Make available to public"**.
   (Anyone with the link can then see event details — don't do this for a
   calendar with anything private on it.)
3. Under **Integrate calendar**, copy the **Public URL to this calendar**
   (the `.ics` link).
4. Set it as a Worker var/secret: `npx wrangler secret put CALENDAR_ICS_URL`
   (or add it to `.dev.vars` locally). The app falls back to the default
   calendar if this isn't set.

## If the calendar can't be made public

This approach only works for a calendar with public sharing turned on. For
a calendar that must stay private, the alternative is the Google Calendar
API with a service account: create one in Google Cloud, share the calendar
with the service account's email address (as you would with a person), and
call the API with a signed JWT instead of a plain `fetch()`. That's a
bigger lift — a Cloud project, a service account key stored as a Worker
secret, and JWT signing in the Worker — and isn't implemented here since
the club's calendar is already public.
