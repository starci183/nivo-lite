import type { LeadDetail } from "@/lib/types";
import type { LeadsT } from "@/features/leads-list/stage";

/** One step of the lead journey with whether real data says it is done. */
export type JourneyStep = { readonly id: string; readonly label: string; readonly isDone: boolean };

/** Derive Captured → Understood → Owner set → Draft ready → Approved → Won/Lost → Invoiced from the lead's real data. */
export const journeyOf = (detail: LeadDetail, t: LeadsT): ReadonlyArray<JourneyStep> => {
  const { lead, responsibilities, executions, events } = detail;
  const invoiceIds = new Set(responsibilities.filter((r) => /^\s*(prepare invoice|chuẩn bị hóa đơn)/i.test(r.title.normalize("NFC"))).map((r) => r.id));
  const followUps = executions.filter((e) => !invoiceIds.has(e.responsibility_id));
  const invoices = executions.filter((e) => invoiceIds.has(e.responsibility_id));
  const isClosed = lead.stage === "won" || lead.stage === "lost" || events.some((e) => e.kind === "outcome.recorded");
  return [
    { id: "captured", label: t("stepCaptured"), isDone: true },
    { id: "context", label: t("stepUnderstood"), isDone: lead.context_summary !== null || events.some((e) => e.kind === "context.summarised") },
    { id: "owner", label: t("stepOwnerSet"), isDone: responsibilities.length > 0 },
    { id: "drafted", label: t("stepDraftReady"), isDone: followUps.length > 0 },
    { id: "approved", label: t("stepApproved"), isDone: followUps.some((e) => e.status === "approved") },
    { id: "outcome", label: lead.stage === "won" ? t("stageWon") : lead.stage === "lost" ? t("stageLost") : t("stageWonOrLost"), isDone: isClosed },
    { id: "invoiced", label: t("stepInvoiced"), isDone: invoices.some((e) => e.status === "approved") },
  ];
};

/** What the header's single primary action does for this lead right now. */
export type PrimaryAction =
  | { readonly kind: "draft"; readonly responsibilityId: string }
  | { readonly kind: "review" }
  | { readonly kind: "propose" }
  | { readonly kind: "none" };

/** Pick the primary action from the lead's state. */
export const primaryActionOf = (detail: LeadDetail): PrimaryAction => {
  const open = [...detail.responsibilities].filter((r) => r.status !== "done").sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
  if (detail.executions.some((e) => e.status === "pending_approval")) return { kind: "review" };
  if (open !== undefined) return { kind: "draft", responsibilityId: open.id };
  if (detail.lead.stage === "won" || detail.lead.stage === "lost") return { kind: "none" };
  return { kind: "propose" };
};
