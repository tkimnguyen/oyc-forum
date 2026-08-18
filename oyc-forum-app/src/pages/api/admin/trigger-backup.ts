import type { APIRoute } from "astro";
import { triggerBackupRun } from "../../../lib/github";

export const POST: APIRoute = async ({ locals, redirect }) => {
  const user = locals.user;

  if (!user || user.role !== "admin") {
    return new Response("Forbidden", { status: 403 });
  }

  const { ok, error } = await triggerBackupRun();

  if (!ok) {
    return new Response(error || "Failed to trigger backup.", { status: 502 });
  }

  return redirect("/admin/storage?triggered=1");
};
