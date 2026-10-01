import "server-only";
import { translator, type Locale } from "@/i18n/core";
import { system } from "@/i18n/dict/system";
import { governance } from "@/i18n/dict/governance";
import { ingest, type Db } from "./core";
import { runQueued, runWork, type EngineCtx } from "./engine";
import { DEFAULT_RULES } from "./policy";

/**
 * Make sure a workspace has its authority row and default rules (one cheap select per session), and add the
 * operating-flow demo examples once (`demo_seeded_at`), all labelled simulated. Safe to call concurrently.
 */
export const ensureFlowDefaults = async (db: Db, ws: string, ownerName: string, locale: Locale): Promise<void> => {
  const { data: auth } = await db.from("authority").select("demo_seeded_at").eq("workspace_id", ws).maybeSingle();
  if (auth?.demo_seeded_at) return;
  if (!auth) {
    await db.from("authority").upsert({ workspace_id: ws, updated_by: "NIVO" }, { onConflict: "workspace_id", ignoreDuplicates: true });
    await db.from("authority_rules").upsert(
      DEFAULT_RULES.map((r) => ({ workspace_id: ws, ...r })),
      { onConflict: "workspace_id,department,action", ignoreDuplicates: true },
    );
  }
  // Only one request seeds the examples: claim the flag first.
  const claimed = await db.from("authority").update({ demo_seeded_at: new Date().toISOString() }).eq("workspace_id", ws).is("demo_seeded_at", null).select("workspace_id");
  if (!claimed.data?.length) return;
  try {
    await seedFlowDemo({ db, ws, actor: ownerName, locale });
  } catch (e) {
    console.error("flow demo seed failed", e);
  }
};

/**
 * The flow examples, performed by the real engine with simulated inputs (no LLM calls):
 * 1. Zalo message → Chatbot hands the lead to Sales → Sales classifies it (auto, by policy).
 * 2. Facebook order of 8,000,000 VND → confirmed → invoice issued (auto chain).
 * 3. Facebook order of 45,000,000 VND → waiting (over authority).
 * 4. Customer D's won deal → invoice waiting (missing amount).
 * 5. Bank transfer with an unclear reference → waiting (unclear outcome, one candidate by amount).
 */
const seedFlowDemo = async (c: EngineCtx) => {
  const t = translator(system, c.locale);
  const g = translator(governance, c.locale);
  const dup = (n: number) => t("duplicateBlocked", { n });
  const gPhone = "0912000701";
  const hPhone = "0912000702";

  // 1. Zalo message → handoff (auto) → classify (auto, preset: no LLM at session time)
  const zalo = await ingest(c.db, c.ws, {
    channel: "zalo", kind: "message", origin: "simulated", sender_name: t("demoGName"), sender_contact: gPhone,
    body: t("demoGNeed"), amount_vnd: null, external_ref: null,
  }, dup);
  const handoff = await runWork(c, {
    action: "handoff_lead", subject_type: "inbound", subject_id: zalo.event.id, inbound_event_id: zalo.event.id, origin: "simulated",
    dedupeKey: `handoff_lead:inbound:${zalo.event.id}`, noChain: true,
    seed: { fields: { contact_name: t("demoGName"), company: t("demoGCompany"), need: t("demoGNeed"), contact: gPhone, channel_label: g("channel_zalo") } },
  });
  const leadG = handoff.lead_id;
  if (leadG) {
    await runWork(c, {
      action: "classify_lead", subject_type: "lead", subject_id: leadG, lead_id: leadG, parent_id: handoff.id, origin: "simulated",
      dedupeKey: `classify_lead:after:${handoff.id}`, preset: true, noChain: true,
      seed: {
        summary: t("classifySummary", { name: t("demoGName"), stage: t("stage_qualified"), pct: 85 }), confidence: 0.85, outcome: "clear",
        fields: { stage: "qualified", next_action: t("demoGNext"), context: t("demoGContext"), missing: null },
      },
    });
  }

  // 2. Facebook order 8,000,000 VND for the same customer → confirmed → invoice (chain drained right away: no LLM)
  const small = await ingest(c.db, c.ws, {
    channel: "facebook", kind: "order", origin: "simulated", sender_name: t("demoGName"), sender_contact: gPhone,
    body: t("demoGItems"), amount_vnd: 8_000_000, external_ref: "FB-001",
  }, dup);
  await runWork(c, {
    action: "confirm_order", subject_type: "inbound", subject_id: small.event.id, inbound_event_id: small.event.id, origin: "simulated",
    dedupeKey: `confirm_order:inbound:${small.event.id}`, seed: { amount_vnd: 8_000_000, fields: { items: t("demoGItems"), amount_vnd: 8_000_000 } },
  });
  await runQueued(c, 3);

  // 3. Facebook order 45,000,000 VND → over authority
  const big = await ingest(c.db, c.ws, {
    channel: "facebook", kind: "order", origin: "simulated", sender_name: t("demoHName"), sender_contact: hPhone,
    body: t("demoHBody"), amount_vnd: 45_000_000, external_ref: "FB-002",
  }, dup);
  await runWork(c, {
    action: "confirm_order", subject_type: "inbound", subject_id: big.event.id, inbound_event_id: big.event.id, origin: "simulated",
    dedupeKey: `confirm_order:inbound:${big.event.id}`, seed: { amount_vnd: 45_000_000, fields: { items: t("demoHItems"), amount_vnd: 45_000_000 } },
  });

  // 4. Customer D (won in the base demo) → invoice with no amount → missing data
  const { data: dRows } = await c.db.from("leads").select("id").eq("workspace_id", c.ws).in("contact_name", ["Customer D", "Khách hàng D"]).limit(1);
  const leadD = dRows?.[0]?.id as string | undefined;
  if (leadD) {
    await runWork(c, { action: "issue_invoice", subject_type: "lead", subject_id: leadD, lead_id: leadD, origin: "simulated", dedupeKey: `issue_invoice:lead:${leadD}`, seed: { amount_vnd: null, fields: {} } });
  }

  // 5. Bank transfer of 8,000,000 VND with an unclear reference → unclear outcome (candidate: Customer G's invoice)
  const pay = await ingest(c.db, c.ws, {
    channel: "bank", kind: "payment", origin: "simulated", sender_name: null, sender_contact: null,
    body: t("demoPayBody"), amount_vnd: 8_000_000, external_ref: t("demoPayRef"),
  }, dup);
  await runWork(c, {
    action: "reconcile_payment", subject_type: "inbound", subject_id: pay.event.id, inbound_event_id: pay.event.id, origin: "simulated",
    dedupeKey: `reconcile_payment:inbound:${pay.event.id}`,
  });
};
