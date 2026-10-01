import "server-only";
import { translator } from "@/i18n/core";
import { system } from "@/i18n/dict/system";
import { governance } from "@/i18n/dict/governance";
import * as ai from "./deepseek";
import { ingest } from "./core";
import { formatVnd, latestInvoiceFor, loadAuthority, runWork, startOrderWork, startPaymentClaim, type EngineCtx } from "./engine";
import { enqueueChatTurn, processorOf } from "./engine-queue";
import { drainAfter } from "./flow-ctx";
import { isKnownPrice } from "./knowledge";
import { knowledgeBrief } from "./knowledge/runtime";
import { escalateToStaff } from "./staff-relay";
import { deliverToChannel } from "./telegram";
import type { Agent, AgentConversation, AgentMessage } from "./types";

/** How the customer reached us: the inbound channel key and the label shown on the lead. */
export type CustomerChannel = { readonly key: "website" | "telegram"; readonly label: string };

const must = <T>(res: { data: T | null; error: { message: string } | null }): T => {
  if (res.error) throw new Error(res.error.message);
  if (res.data === null) throw new Error("Not found");
  return res.data;
};

const agentInput = (a: Agent): ai.AgentInput => ({ name: a.name, handle: a.handle, role: a.role, instructions: a.instructions, knowledge: a.knowledge, approval_rule: a.approval_rule });

/** The channel a stored conversation belongs to. */
export const channelOf = (conv: AgentConversation): CustomerChannel =>
  conv.channel === "telegram" ? { key: "telegram", label: "Telegram" } : { key: "website", label: "Website chat" };

/** A paid record counts as "just confirmed" for a customer's late "đã chuyển khoản" within this window. */
const RECENTLY_PAID_MS = 14 * 86_400_000;

/**
 * One customer turn on a real channel (website chat or Telegram): store the customer's message, let the Chatbot reply
 * within the owner's authority, hand the lead to Sales AI through the gate once the customer has shared enough, and turn a
 * question that needs a commitment into a waiting item with the proposed answer. The reply is delivered back to the
 * channel. While a person has taken over, the AI stays quiet and `reply` is the customer's own stored message.
 * A clear purchase of a listed item (price taken from the knowledge only) becomes an order input that runs the same order
 * work as any other order (Sales confirm → Accounting payment record). "I have paid" becomes ONE check per payment record
 * that waits for the owner: a customer's claim is never evidence of payment.
 * `eventId` is the channel's own id for this message (Telegram `tg:<chat_id>:<message_id>`); the website chat uses the
 * stored agent_message id. It is the inbound idempotency key, so a redelivered message never becomes a second input.
 */
export const customerTurn = async (
  c: EngineCtx, conv: AgentConversation, agent: Agent, body: string,
  opts: { readonly channel?: CustomerChannel; readonly eventId?: string | null } = {},
): Promise<{ reply: AgentMessage; capturedLeadId: string | null; changed: boolean }> => {
  const channel = opts.channel ?? channelOf(conv);
  const { db: supabase, ws } = c;
  const mine = must(await supabase.from("agent_messages").insert({ workspace_id: ws, conversation_id: conv.id, role: "user", body }).select().single<AgentMessage>());
  if (conv.handled_by) return { reply: mine, capturedLeadId: null, changed: true };
  const eventId = opts.eventId?.trim() || mine.id;
  const turns = await loadTurns(c, conv.id);
  // A module whose processor is OpenClaw hands the model step to the engine (a worker on the VPS). The engine only PROPOSES the
  // reply: it comes back through completeQueuedTurn and passes the same gate below. Without a queue (engine offline, not configured)
  // the turn is answered right here, exactly as for the default processor.
  if ((await processorOf(c.db, ws, agent.module)) === "openclaw" && (await enqueueChatTurn(ws, { conversationId: conv.id, messageId: mine.id, eventId, agentId: agent.id, channel: channel.key }))) {
    return { reply: mine, capturedLeadId: null, changed: false };
  }
  const out = await directReply(c, agent, turns, body);
  return applyCustomerOut(c, conv, agent, { body, mine, turns, eventId, channel, out });
};

/** The name under which the engine acts in evidence and in conversation hand-offs. */
export const ENGINE_ACTOR = "OpenClaw";

/** The conversation as chat turns (system lines left out). */
const loadTurns = async (c: EngineCtx, conversationId: string): Promise<Array<ai.ChatTurn>> => {
  const history = ((await c.db.from("agent_messages").select("*").eq("conversation_id", conversationId).order("created_at")).data ?? []) as Array<AgentMessage>;
  return history.filter((m) => m.role !== "system").map((m) => ({ role: m.role === "user" ? "user" : "agent", body: m.body }));
};

/** The default processor: one inline model call. Customer-facing: NIVO base rules + approved module context + PUBLIC business knowledge only (filtered in SQL). */
const directReply = async (c: EngineCtx, agent: Agent, turns: Array<ai.ChatTurn>, body: string): Promise<ai.CustomerChatOut> => {
  const brief = ai.authorityBrief(await loadAuthority(c)) + (await knowledgeBrief(c, agent.module, body, "customer"));
  return ai.customerChat(agentInput(agent), turns, brief); // the one inline LLM call of this request
};

/**
 * The engine's answer (or its fallback) to a queued customer turn. `proposed` is what OpenClaw suggested; null means the engine
 * could not get an answer (gateway down or timed out) and the app answers with the default processor, so the customer is never
 * left waiting. Either way the result goes through applyCustomerOut: authority gate, evidence, channel delivery. A conversation a
 * person has taken over in the meantime gets no AI reply.
 */
export const completeQueuedTurn = async (
  c: EngineCtx, p: { readonly conversationId: string; readonly messageId: string; readonly eventId: string; readonly proposed: ai.CustomerChatOut | null },
): Promise<{ applied: boolean; fallback: boolean }> => {
  const conv = must(await c.db.from("agent_conversations").select("*").eq("id", p.conversationId).eq("workspace_id", c.ws).single<AgentConversation>());
  // A person who took over meanwhile owns the conversation. (The engine's own hand-off still delivers the turn it was made in.)
  if (conv.handled_by && conv.handled_by !== ENGINE_ACTOR) return { applied: false, fallback: false };
  const agent = must(await c.db.from("agents").select("*").eq("id", conv.agent_id).eq("workspace_id", c.ws).single<Agent>());
  const mine = must(await c.db.from("agent_messages").select("*").eq("id", p.messageId).eq("conversation_id", conv.id).single<AgentMessage>());
  const turns = await loadTurns(c, conv.id);
  const out = p.proposed ?? (await directReply(c, agent, turns, mine.body));
  await applyCustomerOut(c, conv, agent, { body: mine.body, mine, turns, eventId: p.eventId, channel: channelOf(conv), out });
  return { applied: true, fallback: p.proposed === null };
};

/** Everything after the model step: the reply, the lead hand-off, the order, the payment claim and the waiting item, all through the gate. */
const applyCustomerOut = async (
  c: EngineCtx, conv: AgentConversation, agent: Agent,
  a: { readonly body: string; readonly mine: AgentMessage; readonly turns: Array<ai.ChatTurn>; readonly eventId: string; readonly channel: CustomerChannel; readonly out: ai.CustomerChatOut },
): Promise<{ reply: AgentMessage; capturedLeadId: string | null; changed: boolean }> => {
  const { body, mine, turns, eventId, channel, out } = a;
  const { db: supabase, ws } = c;
  const t = translator(system, c.locale);
  const gov = translator(governance, c.locale) as (k: string) => string;
  let replyText = out.reply;
  let needsHuman = out.needs_human;
  let reason = out.reason;
  // The price of an order must be one the owner wrote in the knowledge; anything else is a question for a person.
  // "I have paid" is never also a new order (the model sometimes repeats the order it sees earlier in the history).
  let order = out.payment_claim ? null : out.order;
  if (order && !isKnownPrice(agent.knowledge, order.amount_vnd)) {
    order = null;
    needsHuman = true;
    reason = "over_authority";
    replyText = t("orderPriceUnknownReply");
  }
  // "I have paid": the reply is fixed text, so the chatbot can never say a payment was received when nobody checked it.
  const claimOpen = out.payment_claim && conv.lead_id ? await latestInvoiceFor(c, conv.lead_id, "issued") : null;
  const claimPaid = out.payment_claim && conv.lead_id && !claimOpen ? await latestInvoiceFor(c, conv.lead_id, "paid") : null;
  const recentlyPaid = claimPaid?.paid_at && Date.now() - Date.parse(claimPaid.paid_at) < RECENTLY_PAID_MS ? claimPaid : null;
  if (claimOpen) replyText = t("paymentClaimReply", { no: claimOpen.invoice_no });
  else if (recentlyPaid) replyText = t("paymentConfirmedReply", { no: recentlyPaid.invoice_no });
  if (claimOpen || recentlyPaid) needsHuman = false;
  else if (out.payment_claim) {
    // A payment with no open record of ours: a person has to look at it (the reply only says the shop will check).
    needsHuman = true;
    reason = "unclear_outcome";
  }

  const reply = must(await supabase.from("agent_messages").insert({ workspace_id: ws, conversation_id: conv.id, role: "agent", body: replyText }).select().single<AgentMessage>());
  await deliverToChannel(supabase, conv.id, replyText);
  let capturedLeadId: string | null = null;
  let leadId = conv.lead_id;
  const transcript = [...turns, { role: "agent" as const, body: replyText }].map((x) => `${x.role === "user" ? out.lead?.contact_name ?? conv.visitor_name ?? "Customer" : agent.name}: ${x.body}`).join("\n");
  const contact = out.lead ? out.lead.phone || out.lead.email || null : null;

  if (out.lead && !conv.lead_id) {
    const { event, duplicate } = await ingest(supabase, ws, {
      channel: channel.key, kind: "lead", origin: "live", sender_name: out.lead.contact_name, sender_contact: contact,
      body: out.lead.need, amount_vnd: null, external_ref: conv.id, event_id: eventId,
    }, (n) => t("duplicateBlocked", { n }));
    // A redelivered channel event is one input: no second hand-off.
    if (!duplicate) {
      const item = await runWork(c, {
        action: "handoff_lead", subject_type: "conversation", subject_id: conv.id, inbound_event_id: event.id, origin: "live",
        dedupeKey: `handoff_lead:conversation:${conv.id}`,
        seed: { fields: { contact_name: out.lead.contact_name, company: out.lead.company, need: out.lead.need, contact, channel_label: channel.label, conversation_id: conv.id, transcript } },
      });
      capturedLeadId = item.lead_id;
      leadId = item.lead_id ?? leadId;
      // The conversation is now this customer: name it after them (a Telegram account name is often not the person's name).
      await supabase.from("agent_conversations").update({ visitor_name: out.lead.contact_name, ...(item.lead_id ? { lead_id: item.lead_id } : {}) }).eq("id", conv.id);
      const verdict = item.status === "done" ? t("verdictAuto") : t("verdictAsk", { reason: gov(`reason_${item.reason ?? "routine"}`) });
      await supabase.from("agent_messages").insert({ workspace_id: ws, conversation_id: conv.id, role: "system", body: t("chatHandoff", { verdict }) });
    }
  }

  let ordered = false;
  if (order) {
    // Idempotent by the channel event id: a redelivered message is one order input.
    const { event, duplicate } = await ingest(supabase, ws, {
      channel: channel.key, kind: "order", origin: "live", sender_name: out.lead?.contact_name ?? conv.visitor_name, sender_contact: contact,
      body, amount_vnd: order.amount_vnd, external_ref: null, event_id: `${eventId}:order`,
    }, (n) => t("duplicateBlocked", { n }));
    // The same item said again in a later message while its order is still unpaid is not a second order either.
    const same = (s: string) => s.normalize("NFC").toLowerCase().replace(/\s+/g, " ").trim();
    const wanted = same(order.items);
    const openOrders = leadId && !duplicate
      ? ((await supabase.from("orders").select("items").eq("workspace_id", ws).eq("lead_id", leadId).eq("amount_vnd", order.amount_vnd).in("status", ["draft", "confirmed", "invoiced"])).data ?? []) as Array<{ items: string }>
      : [];
    if (openOrders.some((o) => same(o.items) === wanted)) {
      await supabase.from("inbound_events").update({ status: "processed", lead_id: leadId }).eq("id", event.id);
    } else if (!duplicate) {
      await supabase.from("agent_messages").insert({ workspace_id: ws, conversation_id: conv.id, role: "system", body: t("orderRecorded", { items: order.items, amount: formatVnd(order.amount_vnd, c.locale) }) });
      const item = await startOrderWork(c, event, { items: order.items, amount_vnd: order.amount_vnd, lead_id: leadId });
      if (item.lead_id && !leadId) {
        leadId = item.lead_id;
        await supabase.from("agent_conversations").update({ lead_id: item.lead_id }).eq("id", conv.id).is("lead_id", null);
      }
      ordered = true;
    }
  }

  let claimed = false;
  if (claimOpen) {
    const { event, duplicate } = await ingest(supabase, ws, {
      channel: channel.key, kind: "payment", origin: "live", sender_name: conv.visitor_name, sender_contact: null,
      body, amount_vnd: null, external_ref: claimOpen.invoice_no, event_id: `${eventId}:payment`,
    }, (n) => t("duplicateBlocked", { n }));
    if (!duplicate) {
      const { created } = await startPaymentClaim(c, claimOpen, { event, claim: body, channelLabel: channel.label, conversationId: conv.id });
      if (created) await supabase.from("agent_messages").insert({ workspace_id: ws, conversation_id: conv.id, role: "system", body: t("claimRecorded", { no: claimOpen.invoice_no }) });
      // A repeated claim joins the check already open: the input is handled, nothing new to decide.
      else await supabase.from("inbound_events").update({ status: "processed", lead_id: claimOpen.lead_id }).eq("id", event.id);
      claimed = created;
    }
  }

  if (needsHuman) {
    const question = turns.filter((x) => x.role === "user").at(-1)?.body ?? body;
    const item = await runWork(c, {
      action: "reply_customer", subject_type: "conversation", subject_id: conv.id, lead_id: leadId, origin: "live",
      dedupeKey: `reply_customer:message:${mine.id}`, preset: true, noChain: true, forceAsk: reason ?? "unclear_outcome",
      seed: { summary: t("replySummary", { question: question.slice(0, 160) }), draft: out.proposed_answer ?? out.reply, fields: { question, conversation_id: conv.id } },
    });
    // Hand the question to the staff member who advises customers (no-op when the workspace has no active staff).
    if (item.status === "waiting_decision") {
      await escalateToStaff(c, {
        workItemId: item.id, conversationId: conv.id, customerName: out.lead?.contact_name ?? conv.visitor_name ?? "—",
        question, proposed: out.proposed_answer,
      });
    }
    await supabase.from("agent_messages").insert({ workspace_id: ws, conversation_id: conv.id, role: "system", body: t("chatNeedsHuman") });
  }

  const changed = Boolean(capturedLeadId || needsHuman || ordered || claimed);
  // An order queues the payment record right behind the lead's classification: drain one more step for it.
  if (changed) drainAfter(c, ordered ? 3 : 2);
  return { reply, capturedLeadId, changed };
};
