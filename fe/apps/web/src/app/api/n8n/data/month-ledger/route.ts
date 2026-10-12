import { NextResponse, type NextRequest } from "next/server";
import { monthLedgerCsv, verifyRun } from "@/lib/n8n-pipelines";

/**
 * GET /api/n8n/data/month-ledger?period=yyyy-mm: the month's ledger as CSV (default: last month). `?format=json` returns
 * { period, filename, rows, variables, csv } instead, for workflows that also need the summary text. Bearer = the run token.
 */
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const run = await verifyRun(request.headers.get("authorization"));
  if (!run || run.templateKey !== "email-month-ledger") return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const ledger = await monthLedgerCsv(run.workspaceId, request.nextUrl.searchParams.get("period"));
  if (request.nextUrl.searchParams.get("format") === "json") return NextResponse.json(ledger);
  return new NextResponse(ledger.csv, {
    headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="${ledger.filename}"`, "x-nivo-period": ledger.period, "x-nivo-rows": String(ledger.rows) },
  });
}
