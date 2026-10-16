import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { cookies } from "next/headers";

const COOKIE = "sb_vid";

// Free-tier limits key on both a cookie and the IP, so clearing cookies alone
// doesn't reset them. Not a substitute for real accounts.
export async function visitorKeys(req: Request): Promise<string[]> {
  const jar = await cookies();
  let id = jar.get(COOKIE)?.value;
  if (!id || !/^[0-9a-f-]{36}$/.test(id)) {
    id = randomUUID();
    jar.set(COOKIE, id, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 365,
    });
  }
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
  // Hash the IP so raw addresses aren't kept in memory
  const ipKey = `ip:${createHash("sha256").update(ip).digest("hex").slice(0, 32)}`;
  return [`vid:${id}`, ipKey];
}
