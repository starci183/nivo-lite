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

type PromoRaw = {
  chatbot: { id: string; knowledge: string } | null;
  is_founding_member: boolean;
  website_leads: Array<{ id: string; created_at: string }>;
  first_events: Array<{ lead_id: string; at: string }>;
  has_customer_conversation: boolean;
  has_lead_conversation: boolean;
  approved_count: number;
  has_won: boolean;
  invoice_approved: boolean;
};

const HCM_HOUR = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", hourCycle: "h23", timeZone: "Asia/Ho_Chi_Minh" });
const isAfterHours = (iso: string): boolean => {
  const hour = Number(HCM_HOUR.format(new Date(iso)));
  return hour < 8 || hour >= 18;
};

/** Promo and onboarding state for the signed-in workspace (one SQL function call: `promo_state`, under the caller's RLS). */
export const getPromoState = cache(async (): Promise<PromoState> => {
  const session = await getSession();
  const supabase = await supabaseServer();
  const wid = session.workspace.id;
  const { data, error } = await supabase.rpc("promo_state", { ws: wid, founding_from: FOUNDING_OFFER.startsAt, founding_to: FOUNDING_OFFER.endsAt });
  if (error) throw new Error(error.message);
  const raw = data as PromoRaw;
  const chatbot = raw.chatbot;
  const isFoundingMember = raw.is_founding_member;

  const leads = raw.website_leads;
  let avgWaitHours: number | null = null;
  if (leads.length > 0) {
    const first = new Map(raw.first_events.map((e) => [e.lead_id, Date.parse(e.at)]));
    const waits = leads.flatMap((l) => {
      const t = first.get(l.id);
      const wait = t === undefined ? null : (t - Date.parse(l.created_at)) / 3_600_000;
      return wait !== null && wait >= 0 ? [wait] : [];
    });
    if (waits.length > 0) avgWaitHours = waits.reduce((a, b) => a + b, 0) / waits.length;
  }
  const hasWon = raw.has_won;
  const invoiceApproved = raw.invoice_approved;

  const t = await getT(promo);
  const chatHref = chatbot ? `/modules/${chatbot.id}/chat` : "/modules/new?module=chatbot";
  const onboarding: OnboardingStep[] = [
    { key: "buy", label: t("stepBuy"), hint: t("hintBuy"), done: chatbot !== null, href: "/modules/new?module=chatbot", cta: t("ctaBuy") },
    { key: "knowledge", label: t("stepKnowledge"), hint: t("hintKnowledge"), done: (chatbot?.knowledge ?? "").trim().length > 0, href: chatbot ? `/modules/${chatbot.id}` : "/modules/new?module=chatbot", cta: t("ctaKnowledge") },
    { key: "test", label: t("stepTest"), hint: t("hintTest"), done: raw.has_customer_conversation, href: chatHref, cta: t("ctaTest") },
    { key: "lead", label: t("stepLead"), hint: t("hintLead"), done: raw.has_lead_conversation, href: chatHref, cta: t("ctaLead") },
    { key: "approve", label: t("stepApprove"), hint: t("hintApprove"), done: raw.approved_count > 0, href: "/chat", cta: t("ctaApprove") },
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
