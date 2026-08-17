import ICAL from "ical.js";
import { env } from "cloudflare:workers";

// Reads events from a public Google Calendar's iCal feed (no OAuth/API key
// needed since the calendar is published — see docs/calendar.md). The feed
// URL can be overridden via the CALENDAR_ICS_URL Worker var; otherwise it
// defaults to the club's shared events calendar.
const DEFAULT_ICS_URL =
  "https://calendar.google.com/calendar/ical/j0n9v98vs612ojg04bfinil068%40group.calendar.google.com/public/basic.ics";

const WINDOW_DAYS = 90;
// Safety cap per recurring series, so a pathological RRULE (e.g. daily,
// no end date) can't turn a page load into an unbounded loop.
const MAX_OCCURRENCES_PER_EVENT = 60;

export type CalendarEvent = {
  uid: string;
  title: string;
  start: Date;
  end: Date | null;
  allDay: boolean;
  location: string | null;
  description: string | null;
};

export async function fetchUpcomingEvents(): Promise<{
  events: CalendarEvent[];
  error: string | null;
}> {
  const feedUrl = env.CALENDAR_ICS_URL || DEFAULT_ICS_URL;

  let text: string;
  try {
    const response = await fetch(feedUrl);
    if (!response.ok) {
      return { events: [], error: `Calendar feed returned HTTP ${response.status}.` };
    }
    text = await response.text();
  } catch {
    return { events: [], error: "Could not reach the calendar feed." };
  }

  try {
    const jcalData = ICAL.parse(text);
    const component = new ICAL.Component(jcalData);
    const vevents = component.getAllSubcomponents("vevent");

    const now = ICAL.Time.now();
    const windowEnd = now.clone();
    windowEnd.addDuration(ICAL.Duration.fromString(`P${WINDOW_DAYS}D`));
    const nowJs = now.toJSDate();
    const windowEndJs = windowEnd.toJSDate();

    // Group by UID so RECURRENCE-ID overrides (e.g. "this one week moved
    // indoors") attach to their master event instead of showing twice.
    const byUid = new Map<string, ICAL.Component[]>();
    for (const vevent of vevents) {
      const uid = (vevent.getFirstPropertyValue("uid") as string) || vevent.toString();
      if (!byUid.has(uid)) byUid.set(uid, []);
      byUid.get(uid)!.push(vevent);
    }

    const results: CalendarEvent[] = [];

    for (const [uid, comps] of byUid) {
      const master = comps.find((c) => !c.getFirstProperty("recurrence-id")) || comps[0];
      const exceptions = comps.filter((c) => c !== master);

      let event: ICAL.Event;
      try {
        event = new ICAL.Event(master, {
          exceptions: exceptions.map((c) => new ICAL.Event(c)),
        });
      } catch {
        continue; // skip a malformed entry rather than failing the whole feed
      }

      if (!event.isRecurring()) {
        const start = event.startDate.toJSDate();
        const end = event.endDate ? event.endDate.toJSDate() : null;
        if ((end || start) >= nowJs && start <= windowEndJs) {
          results.push({
            uid,
            title: event.summary || "(untitled event)",
            start,
            end,
            allDay: event.startDate.isDate,
            location: event.location || null,
            description: event.description || null,
          });
        }
        continue;
      }

      const iterator = event.iterator();
      let count = 0;
      let next: ICAL.Time | null;

      while (count < MAX_OCCURRENCES_PER_EVENT && (next = iterator.next())) {
        count++;
        if (next.compare(windowEnd) > 0) break;

        let occurrence;
        try {
          occurrence = event.getOccurrenceDetails(next);
        } catch {
          continue;
        }

        const start = occurrence.startDate.toJSDate();
        const end = occurrence.endDate ? occurrence.endDate.toJSDate() : null;
        if ((end || start) < nowJs) continue;

        results.push({
          uid: `${uid}-${next.toString()}`,
          title: occurrence.item.summary || "(untitled event)",
          start,
          end,
          allDay: occurrence.startDate.isDate,
          location: occurrence.item.location || null,
          description: occurrence.item.description || null,
        });
      }
    }

    results.sort((a, b) => a.start.getTime() - b.start.getTime());
    return { events: results, error: null };
  } catch {
    return { events: [], error: "Could not parse the calendar feed." };
  }
}
