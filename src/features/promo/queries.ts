import "server-only";
import { cache } from "react";
import { getSession } from "@/lib/session";
import { supabaseServer } from "@/lib/supabase/server";
import { getT } from "@/i18n/server";
import { promo } from "@/i18n/dict/promo";
import { FOUNDING_OFFER } from "@/lib/promo";

/** One onboarding step; `done` comes from real rows and events only. */
export type OnboardingStep = {
  readonly key: string;
  readonly label: string;
  readonly hint: string;
  readonly done: boolean;
  readonly href: string;
  readonly cta: string;
};

/** Website-channel lead facts computed from this workspace. Wait is null when no lead has a recorded first response. */
export type WebsiteLeadStats = { readonly count: number; readonly afterHoursCount: number; readonly avgWaitHours: number | null };

/** Everything the campaign and onboarding surfaces need, all from the workspace's own data. */
export type PromoState = {
  readonly hasChatbot: boolean;
  readonly chatbotAgentId: string | null;
  readonly isFoundingMember: boolean;
  readonly websiteLeadStats: WebsiteLeadStats;
  readonly onboarding: ReadonlyArray<OnboardingStep>;
};

type LeadRow = { id: string; created_at: string };
type EventRow = { lead_id: string | null; kind: string; created_at: string };

const HCM_HOUR = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", hourCycle: "h23", timeZone: "Asia/Ho_Chi_Minh" });
const isAfterHours = (iso: string): boolean => {
  const hour = Number(HCM_HOUR.format(new Date(iso)));
  return hour < 8 || hour >= 18;
};

/** Promo and onboarding state for the signed-in workspace. */
export const getPromoState = cache(async (): Promise<PromoState> => {
  const session = await getSession();
  const supabase = await supabaseServer();
  const wid = session.workspace.id;
  const [agentsRes, leadsRes, purchasedRes, convRes, approvedRes, wonRes] = await Promise.all([
    supabase.from("agents").select("id, knowledge").eq("workspace_id", wid).eq("module", "chatbot").order("created_at").limit(1),
    supabase.from("leads").select("id, created_at").eq("workspace_id", wid).ilike("channel", "%website%"),
    supabase.from("events").select("created_at").eq("workspace_id", wid).eq("kind", "module.purchased"),
    supabase.from("agent_conversations").select("kind, lead_id").eq("workspace_id", wid),
    supabase.from("executions").select("id, responsibility_id").eq("workspace_id", wid).eq("status", "approved"),
    supabase.from("leads").select("id").eq("workspace_id", wid).eq("stage", "won"),
  ]);

  const chatbot = ((agentsRes.data ?? []) as Array<{ id: string; knowledge: string }>)[0] ?? null;
  const start = Date.parse(FOUNDING_OFFER.startsAt);
  const end = Date.parse(FOUNDING_OFFER.endsAt);
  const isFoundingMember = ((purchasedRes.data ?? []) as Array<{ created_at: string }>).some((e) => {
    const t = Date.parse(e.created_at);
    return t >= start && t <= end;
  });

  const leads = (leadsRes.data ?? []) as LeadRow[];
  let avgWaitHours: number | null = null;
  if (leads.length > 0) {
    const { data } = await supabase
      .from("events")
      .select("lead_id, kind, created_at")
      .eq("workspace_id", wid)
      .in("lead_id", leads.map((l) => l.id))
      .in("kind", ["execution.approved", "responsibility.assigned"])
      .order("created_at");
    const first = new Map<string, number>();
    for (const e of (data ?? []) as EventRow[]) if (e.lead_id && !first.has(e.lead_id)) first.set(e.lead_id, Date.parse(e.created_at));
    const waits = leads.flatMap((l) => {
      const t = first.get(l.id);
      const wait = t === undefined ? null : (t - Date.parse(l.created_at)) / 3_600_000;
      return wait !== null && wait >= 0 ? [wait] : [];
    });
    if (waits.length > 0) avgWaitHours = waits.reduce((a, b) => a + b, 0) / waits.length;
  }

  const wonIds = ((wonRes.data ?? []) as Array<{ id: string }>).map((l) => l.id);
  let hasWon = false;
  if (wonIds.length > 0) {
    const { data } = await supabase.from("events").select("id").eq("workspace_id", wid).eq("kind", "outcome.recorded").in("lead_id", wonIds).limit(1);
    hasWon = (data ?? []).length > 0;
  }

  const convs = (convRes.data ?? []) as Array<{ kind: string; lead_id: string | null }>;
  const approved = (approvedRes.data ?? []) as Array<{ id: string; responsibility_id: string }>;
  let invoiceApproved = false;
  if (approved.length > 0) {
    const { data } = await supabase
      .from("responsibilities")
      .select("id")
      .eq("workspace_id", wid)
      .or("title.ilike.Prepare invoice%,title.ilike.Chuẩn bị hóa đơn%")
      .in("id", [...new Set(approved.map((a) => a.responsibility_id))])
      .limit(1);
    invoiceApproved = (data ?? []).length > 0;
  }

  const t = await getT(promo);
  const chatHref = chatbot ? `/modules/${chatbot.id}/chat` : "/modules/new?module=chatbot";
  const onboarding: OnboardingStep[] = [
    { key: "buy", label: t("stepBuy"), hint: t("hintBuy"), done: chatbot !== null, href: "/modules/new?module=chatbot", cta: t("ctaBuy") },
    { key: "knowledge", label: t("stepKnowledge"), hint: t("hintKnowledge"), done: (chatbot?.knowledge ?? "").trim().length > 0, href: chatbot ? `/modules/${chatbot.id}` : "/modules/new?module=chatbot", cta: t("ctaKnowledge") },
    { key: "test", label: t("stepTest"), hint: t("hintTest"), done: convs.some((c) => c.kind === "customer"), href: chatHref, cta: t("ctaTest") },
    { key: "lead", label: t("stepLead"), hint: t("hintLead"), done: convs.some((c) => c.lead_id !== null), href: chatHref, cta: t("ctaLead") },
    { key: "approve", label: t("stepApprove"), hint: t("hintApprove"), done: approved.length > 0, href: "/chat", cta: t("ctaApprove") },
    { key: "won", label: t("stepWon"), hint: t("hintWon"), done: hasWon, href: "/leads", cta: t("ctaWon") },
    { key: "invoice", label: t("stepInvoice"), hint: t("hintInvoice"), done: invoiceApproved, href: "/responsibilities", cta: t("ctaInvoice") },
  ];

  return {
    hasChatbot: chatbot !== null,
    chatbotAgentId: chatbot?.id ?? null,
    isFoundingMember,
    websiteLeadStats: {
      count: leads.length,
      afterHoursCount: leads.filter((l) => isAfterHours(l.created_at)).length,
      avgWaitHours,
    },
    onboarding,
  };
});
