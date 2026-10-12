import { NextResponse, type NextRequest } from "next/server";
import { dailySummary, verifyRun } from "@/lib/n8n-pipelines";

/** GET /api/n8n/data/daily-summary?date=yyyy-mm-dd: the day's figures and the owners to email. Bearer = the run token; the workspace is the run's. */
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const run = await verifyRun(request.headers.get("authorization"));
  if (!run || run.templateKey !== "email-daily-report") return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json(await dailySummary(run.workspaceId, request.nextUrl.searchParams.get("date")));
}
