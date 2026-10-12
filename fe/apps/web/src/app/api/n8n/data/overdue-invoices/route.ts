import { NextResponse, type NextRequest } from "next/server";
import { overdueInvoices, verifyRun } from "@/lib/n8n-pipelines";

/** GET /api/n8n/data/overdue-invoices: overdue invoices of customers with an email, one item per reminder (variables ready). Bearer = the run token. */
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const run = await verifyRun(request.headers.get("authorization"));
  if (!run || run.templateKey !== "email-debt-reminder") return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json(await overdueInvoices(run.workspaceId, run.config));
}
