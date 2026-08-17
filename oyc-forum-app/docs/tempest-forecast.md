# Wind forecast for the next race

The `/calendar` page shows a wind forecast (average, gust, direction) for
the next upcoming "race" event, pulled from the club's Tempest weather
station (https://tempestwx.com/station/115814/) via WeatherFlow's REST API.

## What counts as "the next race"

Any calendar event whose title starts with **"Class "** (e.g. "Class E
Boat", "Class Laser") — matching the club's naming convention on this
calendar. Everything else (meetings, socials, etc.) is ignored for this
purpose. If that convention ever changes, update the match in
`src/pages/calendar.astro`:

```js
const nextRace = events.find((event) => event.title.trim().toLowerCase().startsWith("class "));
```

## One-time setup: getting a Tempest access token

WeatherFlow's forecast API needs a personal access token tied to your
Tempest account (the same account that owns the station):

1. Log in at [tempestwx.com](https://tempestwx.com).
2. Go to **Settings** (gear icon) → **Data Authorizations**.
3. Create a **Personal Use Token** and copy it.
4. Set it as a Worker secret: `npx wrangler secret put TEMPEST_TOKEN`
   (and add it to `.dev.vars` locally for `npm run dev`).

If `TEMPEST_TOKEN` isn't set, the Wind Forecast card on `/calendar` just
says so — the rest of the page still works.

## Pointing it at a different station

The station ID (`115814`) is the default. To use a different station,
set the `TEMPEST_STATION_ID` Worker var/secret to its numeric ID (visible
in that station's tempestwx.com URL).

## How the matching works

`src/lib/tempest.ts` calls WeatherFlow's `better_forecast` endpoint, which
returns an hourly forecast array (wind speed/gust/direction per hour, out
to about a week ahead). It finds the hour closest to the race's start
time:

- Within 90 minutes: shown as-is.
- Further than 90 minutes but within a day: still shown, labeled as the
  "nearest available forecast hour" so it's clear it's not an exact match.
- More than a day off (the race is further out than WeatherFlow's forecast
  horizon): shown as "too far out for a wind forecast yet."
