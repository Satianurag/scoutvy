import { createHash, timingSafeEqual } from "node:crypto";
import { getDb } from "./db.js";
import { flushPush } from "./notifications.js";

// Daily recovery on the free plan; normal bounty events attempt delivery immediately.
export async function maintainPush(request: Request) {
  const secret = process.env.CRON_SECRET;
  const authorization = request.headers.get("authorization") ?? "";
  const digest = (value: string) => createHash("sha256").update(value).digest();
  if (!secret || !timingSafeEqual(digest(authorization), digest(`Bearer ${secret}`))) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  await flushPush(getDb());
  return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
