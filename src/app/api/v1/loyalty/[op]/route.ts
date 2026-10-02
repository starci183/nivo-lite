import type { NextRequest } from "next/server";
import { apiError, apiOk, handle, jsonBody } from "@/lib/api-v1";
import { awardLoyaltyPoints, createLoyaltyPromo, listLoyaltyMembers, redeemLoyaltyReward } from "@/lib/module-loyalty-api";

/**
 * Loyalty endpoints (Bearer key):
 *   GET  /api/v1/loyalty/members?phone=|limit=   scope loyalty:read
 *   POST /api/v1/loyalty/award                   scope loyalty:write   points for a sale made outside NIVO (idempotent on "ref")
 *   POST /api/v1/loyalty/redeem                  scope loyalty:write   a reward for a member (auto below the owner's limit, else a decision)
 *   POST /api/v1/loyalty/promo                   scope loyalty:write   a promotion draft for a segment (always waits for the owner)
 */
export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Ctx = { params: Promise<{ op: string }> };

export const GET = async (request: NextRequest, { params }: Ctx) => {
  const { op } = await params;
  if (op !== "members") return apiError(404, "not_found", "Không có endpoint này.");
  return handle(request, "loyalty:read", async (who) => {
    const url = request.nextUrl.searchParams;
    return apiOk(await listLoyaltyMembers(who, url.get("phone"), Math.min(200, Math.max(1, Number(url.get("limit")) || 50))));
  });
};

export const POST = async (request: NextRequest, { params }: Ctx) => {
  const { op } = await params;
  if (op !== "award" && op !== "redeem" && op !== "promo") return apiError(404, "not_found", "Không có endpoint này.");
  return handle(request, "loyalty:write", async (who) => {
    const body = await jsonBody(request);
    if (op === "award") return apiOk(await awardLoyaltyPoints(who, body), 201);
    if (op === "redeem") return apiOk(await redeemLoyaltyReward(who, body));
    return apiOk(await createLoyaltyPromo(who, body), 201);
  });
};
