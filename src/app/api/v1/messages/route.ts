import type { NextRequest } from "next/server";
import { apiOk, handle, jsonBody } from "@/lib/api-v1";
import { sendMessage } from "@/lib/api-v1-ops";

/**
 * POST /api/v1/messages { conversation_id | lead_id, text, require_approval? }: ask the Chatbot to message a customer conversation. The message is a work item through
 * the authority gate: when the owner's rule says ask (or require_approval is true) it waits as a decision in Office and is NOT sent. Optional header Idempotency-Key. Bearer key.
 */
export const dynamic = "force-dynamic";
export const maxDuration = 30;

export const POST = (request: NextRequest) =>
  handle(request, "messages:write", async (who) => apiOk(await sendMessage(who, await jsonBody(request), request.headers.get("idempotency-key")), 202));
