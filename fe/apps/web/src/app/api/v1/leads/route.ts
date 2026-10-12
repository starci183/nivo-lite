import type { NextRequest } from "next/server";
import { apiOk, handle, jsonBody } from "@/lib/api-v1";
import { listLeads, upsertLead } from "@/lib/api-v1-ops";

/** POST /api/v1/leads: create or update a customer (through the sales hand-off and the authority gate). GET /api/v1/leads?status=new|qualified|proposal|won|lost&limit=50. Bearer key. */
export const dynamic = "force-dynamic";
export const maxDuration = 30;

export const POST = (request: NextRequest) =>
  handle(request, "leads:write", async (who) => {
    const out = await upsertLead(who, await jsonBody(request));
    return apiOk(out, out.status === "created" ? 201 : 200);
  });

export const GET = (request: NextRequest) =>
  handle(request, "leads:read", async (who) => {
    const url = request.nextUrl.searchParams;
    const limit = Math.min(200, Math.max(1, Number(url.get("limit")) || 50));
    return apiOk(await listLeads(who, url.get("status"), limit));
  });
