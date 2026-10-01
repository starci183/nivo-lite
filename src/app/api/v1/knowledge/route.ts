import type { NextRequest } from "next/server";
import { apiOk, handle, jsonBody } from "@/lib/api-v1";
import { addKnowledge } from "@/lib/api-v1-ops";

/** POST /api/v1/knowledge { title, content, topic?, visibility?: "internal"|"public", tags? }: add a knowledge source (chunked and indexed). Bearer key. */
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export const POST = (request: NextRequest) =>
  handle(request, "knowledge:write", async (who) => apiOk(await addKnowledge(who, await jsonBody(request)), 201));
