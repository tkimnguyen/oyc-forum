import { env } from "cloudflare:workers";

// Pulls an hourly wind forecast from WeatherFlow's Tempest "Better Forecast"
// API for the club's weather station (https://tempestwx.com/station/115814/).
// Needs a personal access token from the station owner's Tempest account —
// see docs/tempest-forecast.md for how to generate one. Without a token
// configured, callers just get back a clear "not configured" error.

const DEFAULT_STATION_ID = "115814";
const FORECAST_URL = "https://swd.weatherflow.com/swd/rest/better_forecast";

// If the nearest available forecast hour is further than this from the
// requested time, the result is flagged as approximate (or out of range
// entirely, if there's nothing within a day).
const APPROXIMATE_THRESHOLD_MINUTES = 90;
const OUT_OF_RANGE_THRESHOLD_MINUTES = 24 * 60;

export type WindForecast = {
  forecastTime: Date;
  windAvgKts: number;
  windGustKts: number;
  windDirectionCardinal: string;
  approximate: boolean;
};

export async function fetchWindForecastFor(targetDate: Date): Promise<{
  forecast: WindForecast | null;
  error: string | null;
}> {
  const token = env.TEMPEST_TOKEN;

  if (!token) {
    return {
      forecast: null,
      error: "Not configured — set the TEMPEST_TOKEN Worker secret to see wind forecasts here.",
    };
  }

  const stationId = env.TEMPEST_STATION_ID || DEFAULT_STATION_ID;
  const url = `${FORECAST_URL}?station_id=${encodeURIComponent(stationId)}&token=${encodeURIComponent(token)}&units_wind=kts`;

  let data: any;
  try {
    const response = await fetch(url);
    if (!response.ok) {
      return { forecast: null, error: `Tempest API returned HTTP ${response.status}.` };
    }
    data = await response.json();
  } catch {
    return { forecast: null, error: "Could not reach the Tempest forecast API." };
  }

  const hourly = data?.forecast?.hourly;
  if (!Array.isArray(hourly) || hourly.length === 0) {
    return { forecast: null, error: "Tempest API returned no hourly forecast data." };
  }

  const targetSeconds = targetDate.getTime() / 1000;

  let closest: any = null;
  let closestDiffSeconds = Infinity;
  for (const hour of hourly) {
    if (typeof hour.time !== "number") continue;
    const diff = Math.abs(hour.time - targetSeconds);
    if (diff < closestDiffSeconds) {
      closestDiffSeconds = diff;
      closest = hour;
    }
  }

  if (!closest) {
    return { forecast: null, error: "Could not find a matching forecast hour." };
  }

  const diffMinutes = closestDiffSeconds / 60;
  if (diffMinutes > OUT_OF_RANGE_THRESHOLD_MINUTES) {
    return {
      forecast: null,
      error: "That's too far out for a wind forecast yet — check back closer to race day.",
    };
  }

  return {
    forecast: {
      forecastTime: new Date(closest.time * 1000),
      windAvgKts: closest.wind_avg,
      windGustKts: closest.wind_gust,
      windDirectionCardinal: closest.wind_direction_cardinal || "—",
      approximate: diffMinutes > APPROXIMATE_THRESHOLD_MINUTES,
    },
    error: null,
  };
}
