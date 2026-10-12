import "server-only";
import { logEvidence, matchLead } from "./core";
import { sendCommand } from "./agent-commands";
import { ensureResponsibility, loadAuthority, type EngineCtx, type Performed, type Performer } from "./engine";
import { emitEvent } from "./outbound-events";
import { noteKnowledgeGap } from "./brain/gaps-detect";
import { lensFor } from "./knowledge/lens";
import { analyzeTurn } from "./lead-flow-ai";
import {
  composeAsk, contactIn, EMPTY_SIGNALS, effectiveConfidence, escalationOf, handoffNeed, handoffReady, identityPatch, lines, mergeSignals, nextStep, normEmail, normPhone,
  parseAnalysis, recordAnswer, scoreLead, sourceLine, addTouch, matchFlow,
  type Analysis, type Identity, type LeadSource, type SourceKind, type Step,
} from "./lead-flow-rules";
import {
  LEAD_GEN_ACTOR, ensureConversation, escalateLead, flowByLead, flowCandidates, flowSetup, flowWindow, heldByPerson, leadGenAgent, loc, mustFlow, now, patchFlow, pick, resumeFlow,
  sayInConversation, sendToFlow, str, type FlowRow,
} from "./lead-flow";
import { loadMetaPage, privateReply, privateReplyInstagram, replyToComment, replyToInstagramComment } from "./meta";
import type { Proposal, WorkItem } from "./flow-types";
import type { Lead } from "./types";

/**
 * Performers of the lead_gen module: what actually happens once the authority gate lets an action through (automatically, or after a person
 * approved it). Registered in module-performers.ts. The decisions live in lead-flow-rules.ts (pure) and the chaining in lead-flow.ts; here is
 * the I/O: the lead record, Meta, the conversation transcript, the score, the hand-off.
 *
 *   capture_lead            create or merge the lead (psid / igsid / phone / email), keep the source, open the flow
 *   score_lead              read the turn (<= 1 model call), store answers and signals, score hot / warm / cold, decide the next step
 *   greet_prospect          first reply inside the 24 hour window (the turn's reply, composed from public knowledge)
 *   ask_qualifying          the owner's next question (at most 4, one per turn)
 *   reply_comment_public    short public reply under the comment (a negative comment waits for a person)
 *   private_reply_comment   one private message per comment
 *   handoff_to_sales        hot leads only; then Sales classify_lead (engine FLOW_NEXT)
 *   follow_up_lead          warm: one follow-up inside the window, else Sales follows up
 *   close_lead              cold: one polite closing line inside the window, then the bot stops
 *   message_with_human_agent_tag   a person's reply outside 24 hours with the HUMAN_AGENT tag (ask mode only)
 */

const leadHref = (id: string | null | undefined) => (id ? `/leads/${id}` : "/chat");
const clip = (s: string, n: number): string => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);
const FALLBACK_NAME = { facebook: "Khách Facebook", instagram: "Khách Instagram" } as const;

/* ------------------------------------------------------------------ fields <-> source / identity */

const sourceOf = (f: Record<string, unknown>): LeadSource => {
  let referral: LeadSource["referral"] = null;
  try { const r = JSON.parse(str(f.referral) || "null") as LeadSource["referral"]; referral = r && typeof r === "object" ? r : null; } catch { referral = null; }
  const platform = str(f.platform) === "instagram" || /instagram/i.test(str(f.channel_label)) ? "instagram" : "facebook";
  const kind = (["leadgen", "dm", "comment", "mention"].includes(str(f.source_kind)) ? str(f.source_kind) : "leadgen") as SourceKind;
  return {
    platform, kind, post_id: str(f.post_id) || null, ad_id: str(f.ad_id) || null, form_id: str(f.form_id) || null, comment_id: str(f.comment_id) || null,
    leadgen_id: str(f.leadgen_id) || null, referral, at: Number(f.message_at) > 0 ? new Date(Number(f.message_at)).toISOString() : now(),
  };
};

const identityOf = (f: Record<string, unknown>): Identity => {
  const fromContact = contactIn(str(f.contact));
  return {
    psid: str(f.psid) || null, igsid: str(f.igsid) || null,
    phone: normPhone(f.phone) ?? fromContact.phone ?? (normPhone(f.contact)), email: normEmail(f.email) ?? fromContact.email,
  };
};

const channelLabel = (s: LeadSource): string =>
  s.kind === "leadgen" ? "Facebook Lead Ads" : s.platform === "instagram" ? (s.kind === "dm" ? "Instagram" : s.kind === "mention" ? "Instagram (nhắc tên)" : "Instagram (bình luận)")
    : s.kind === "dm" ? "Facebook Messenger" : "Facebook (bình luận)";

/* ------------------------------------------------------------------ capture_lead */

const capture: Performer = {
  prepare: async (c, item) => {
    const f = item.proposal.fields ?? {};
    const src = sourceOf(f);
    const name = str(f.contact_name) || FALLBACK_NAME[src.platform];
    return { proposal: { ...item.proposal, summary: pick(c, `Ghi nhận khách ${name} từ ${sourceLine(src)}`, `Capture ${name} from ${sourceLine(src)}`), fields: f } };
  },
  perform: async (c, item, p): Promise<Performed> => {
    const f = p.fields as Record<string, unknown>;
    const src = sourceOf(f);
    const id = identityOf(f);
    const connectionId = str(f.connection_id) || null;
    const name = str(f.contact_name).trim() || null;
    const text = str(f.text);
    const channel = str(f.channel_label) || channelLabel(src);

    // 1. who is this: an existing flow by Messenger / Instagram id, phone or email; else an existing lead by phone or email; else new.
    const hit = matchFlow(await flowCandidates(c.db, c.ws, id), id, connectionId);
    let flow: FlowRow | null = hit?.row ?? null;
    let lead: Lead | null = flow?.lead_id ? (((await c.db.from("leads").select("*").eq("id", flow.lead_id).maybeSingle()).data ?? null) as Lead | null) : null;
    if (!lead) lead = await matchLead(c.db, c.ws, { phone: id.phone, email: id.email });
    const matched = !!lead;
    const need = str(f.need).trim() || clip(text, 300) || sourceLine(src);
    if (!lead) {
      const { data, error } = await c.db.from("leads").insert({
        workspace_id: c.ws, contact_name: name ?? FALLBACK_NAME[src.platform], company: str(f.company) || pick(c, "(chưa cho biết)", "(not shared)"), channel, need,
        phone: id.phone, email: id.email, origin: item.origin,
      }).select().single();
      if (error) throw new Error(error.message);
      lead = data as Lead;
      await ensureResponsibility(c, lead);
      await logEvidence(c.db, c.ws, { lead_id: lead.id, work_item_id: item.id, kind: "lead.captured", actor: LEAD_GEN_ACTOR, summary: pick(c, `Ghi nhận khách từ ${sourceLine(src)}`, `Lead captured from ${sourceLine(src)}`), evidence: clip(text || need, 400) });
      await emitEvent(c.ws, "lead.created", { lead_id: lead.id, name: lead.contact_name, company: lead.company, channel: lead.channel, need: lead.need, phone: lead.phone ?? null, email: lead.email ?? null, origin: item.origin }, `lead.created:${lead.id}`);
    } else {
      const patch: Record<string, unknown> = {};
      if (id.phone && !lead.phone) patch.phone = id.phone;
      if (id.email && !lead.email) patch.email = id.email;
      if (Object.keys(patch).length) await c.db.from("leads").update(patch).eq("id", lead.id);
      await logEvidence(c.db, c.ws, { lead_id: lead.id, work_item_id: item.id, kind: "lead.touch", actor: LEAD_GEN_ACTOR, summary: pick(c, `Khách quay lại qua ${sourceLine(src)}`, `Lead touched again via ${sourceLine(src)}`), evidence: clip(text, 400) || null });
    }

    // 2. the flow: one row per lead; identity keys fill in, touches add up, the first source is kept.
    const lastUserAt = src.kind === "dm" && Number(f.message_at) ? new Date(Number(f.message_at)).toISOString() : null;
    if (!flow) {
      flow = ((await c.db.from("lead_flows").select("*").eq("workspace_id", c.ws).eq("lead_id", lead.id).maybeSingle()).data ?? null) as FlowRow | null;
    }
    if (!flow) {
      const ins = await c.db.from("lead_flows").insert({
        workspace_id: c.ws, lead_id: lead.id, connection_id: connectionId, platform: src.platform, psid: id.psid, igsid: id.igsid, phone: id.phone, email: id.email, name,
        source: src, touches: [src], ...(lastUserAt ? { last_user_at: lastUserAt, last_user_text: clip(text, 1000) } : {}),
      }).select().single();
      if (ins.error?.code === "23505") {
        flow = (await flowCandidates(c.db, c.ws, id)).find((r) => r.lead_id === lead!.id || r.psid === id.psid || r.igsid === id.igsid) ?? null;
      } else if (ins.error) throw new Error(ins.error.message);
      else flow = ins.data as FlowRow;
    }
    if (!flow) throw new Error("lead flow could not be opened");
    const patch: Record<string, unknown> = { ...identityPatch(flow, id), touches: addTouch(flow.touches ?? [], src) };
    if (!flow.lead_id) patch.lead_id = lead.id;
    if (!flow.connection_id && connectionId) patch.connection_id = connectionId;
    if (!flow.platform) patch.platform = src.platform;
    if (name && !flow.name) patch.name = name;
    if (lastUserAt) { patch.last_user_at = lastUserAt; patch.last_user_text = clip(text, 1000); }
    flow = await patchFlow(c.db, flow.id, patch);

    // 3. the transcript: a conversation per DM thread / comment, so a person can read and take it over.
    if (src.kind === "dm" || src.kind === "comment") {
      const agent = await leadGenAgent(c, flow.connection_id);
      const externalId = src.kind === "comment" ? `comment:${src.comment_id}` : (flow.platform === "instagram" ? flow.igsid : flow.psid);
      if (agent && externalId) {
        const conv = await ensureConversation(c, { flow, externalId, agentId: agent.id });
        await sayInConversation(c.db, c.ws, conv.id, "user", text || (src.kind === "dm" ? "[tệp đính kèm]" : ""));
        flow = await patchFlow(c.db, flow.id, { conversation_id: conv.id });
      }
    }
    return {
      summary: matched ? pick(c, `Gộp vào khách đã có ${lead.contact_name} (${sourceLine(src)})`, `Merged into existing lead ${lead.contact_name} (${sourceLine(src)})`) : pick(c, `Đã ghi nhận ${lead.contact_name} từ ${sourceLine(src)}`, `Captured ${lead.contact_name} from ${sourceLine(src)}`),
      evidence: "captured", href: leadHref(lead.id), lead_id: lead.id,
    };
  },
};

/* ------------------------------------------------------------------ score_lead */

/** What score_lead decides: a state-machine step, or `comment` (answer in public and in private) for a comment. */
type Plan = Step["step"] | "comment";

const STEP_LABEL: Readonly<Record<Plan, [string, string]>> = {
  comment: ["trả lời bình luận", "answer the comment"],
  escalate: ["chuyển cho người", "hand to a person"], greet: ["chào khách", "greet"], ask: ["hỏi câu tiếp", "ask the next question"], ask_contact: ["xin liên hệ", "ask for contact"],
  handoff: ["chuyển Sales", "hand to Sales"], follow_up: ["nhắn lại", "follow up"], close: ["khép lại", "close"], hold: ["giữ nguyên", "hold"],
};

const score: Performer = {
  prepare: async (c, item) => {
    let flow = await mustFlow(c, item.lead_id);
    const f = (item.proposal.fields ?? {}) as Record<string, unknown>;
    // A person holds this lead: the bot reads nothing and says nothing (no model call) until they hand it back.
    if (flow.state === "escalated") {
      if (await heldByPerson(c.db, c.ws, flow)) return { proposal: { ...item.proposal, summary: pick(c, "Khách đang do người phụ trách: bot giữ im lặng.", "A person has this lead: the bot stays silent."), fields: { ...f, step: "hold" } } };
      flow = await resumeFlow(c.db, flow);
    }
    const kind = ((["leadgen", "dm", "comment", "mention"].includes(str(f.source_kind)) ? str(f.source_kind) : flow.source.kind) ?? "dm") as SourceKind;
    const turn = str(f.turn) || `manual:${item.id}`;
    const text = (str(f.text) || (kind === "dm" ? flow.last_user_text ?? "" : "")).trim();
    const setup = await flowSetup(c);
    const authority = await loadAuthority(c);
    const agent = await leadGenAgent(c, flow.connection_id);
    const pending = flow.pending_question !== null ? setup.questions[flow.pending_question] ?? null : null;

    // One metered model call per turn, and none when this turn already has its analysis (a retried step) or a keyword settles it.
    let analysis: Analysis | null = flow.analysis?.turn === turn ? flow.analysis : null;
    let aiFailed = false;
    if (!analysis) {
      if ((kind === "comment" || kind === "mention") && !text) {
        analysis = parseAnalysis({ confidence: 1 }, turn); // a sticker or a photo under a post: answered with the plain lines, no model call
      } else if (kind === "leadgen" && !text) {
        analysis = parseAnalysis({ signals: { need: str(f.need).split("\n")[0] || null, contact: str(f.contact) || null, interest: "medium" }, confidence: 1 }, turn);
      } else if (kind === "dm" && !text) {
        aiFailed = true; // an attachment the bot cannot read: a person looks at it
      } else {
        const r = await analyzeTurn({
          c, agent, turn, kind, text, name: flow.name, pendingQuestion: pending, criteriaText: setup.criteriaText,
          first: flow.state === "new" && kind === "dm", voice: [authority?.brand_voice, authority?.reply_style].filter(Boolean).join("\n"),
        });
        analysis = r.analysis;
        aiFailed = !analysis;
      }
      if (analysis) await patchFlow(c.db, flow.id, { analysis });
      // A direct question the knowledge could not answer is remembered for the owner (the chatbot's learning loop), once per fresh reading.
      if (analysis?.knowledge_gap && flow.conversation_id) {
        await noteKnowledgeGap(c.db, lensFor(c.ws, "lead_gen", { audience: "customer" }), {
          conversationId: flow.conversation_id, question: analysis.knowledge_gap.question,
          signals: { knowledgeGap: analysis.knowledge_gap, needsHuman: true, proposedAnswer: null, isTransaction: false },
        });
      }
    }

    const confidence = analysis ? effectiveConfidence(analysis) : 0;
    const base = { turn, conversation_id: flow.conversation_id ?? "", connection_id: flow.connection_id ?? "", source_kind: kind, comment_id: str(f.comment_id), post_id: str(f.post_id) };
    const reason = escalationOf({ text, flags: analysis?.flags, confidence, aiFailed });
    if (reason) {
      await escalateLead(c, { flow, reason, text, turn, origin: item.origin, notify: kind === "dm" });
      return { proposal: { ...item.proposal, summary: pick(c, `Chuyển ${flow.name ?? "khách"} cho người (${reason})`, `Hand ${flow.name ?? "the lead"} to a person (${reason})`), fields: { ...f, ...base, step: "escalate", escalation: reason, confidence } } };
    }

    // Signals -> score (pure). Contact and need from the form or from the first message count too.
    let signals = mergeSignals(flow.signals, analysis!.signals);
    const given = contactIn(str(f.contact));
    const contact = signals.contact ?? given.phone ?? given.email ?? flow.phone ?? flow.email;
    signals = { ...signals, contact, need: signals.need ?? (kind === "leadgen" ? str(f.need).split("\n")[0] || null : null) };
    const result = scoreLead(signals, setup.criteria);
    const ready = handoffReady(signals, flow);
    const window = await flowWindow(flow);
    const negative = kind === "comment" && analysis!.sentiment === "negative";
    const decided = nextStep({
      state: flow.state, kind, questions: setup.questions, asked: flow.asked, score: result, handoffOk: result.level === "hot" && ready.ok, escalation: null,
      canMessage: kind === "dm" && window.status === "open", contactKnown: !!contact, contactAsked: !!flow.contact_asked_at, greeted: !!flow.greeted_at,
    });
    // Comments and mentions have their own path: a comment is answered in public and in private, a mention is only recorded.
    const step: Plan = kind === "comment" ? "comment" : kind === "mention" ? "hold" : decided.step;
    const index = decided.step === "ask" ? decided.index : flow.asked;
    const question = decided.step === "ask" ? setup.questions[decided.index] ?? "" : "";
    const handoffAlso = result.level === "hot" && ready.ok && step !== "handoff" && step !== "hold";
    const label = STEP_LABEL[step][c.locale === "en" ? 1 : 0];
    return {
      proposal: {
        ...item.proposal,
        summary: pick(c, `Chấm ${flow.name ?? "khách"}: ${result.level} → ${label}`, `Score ${flow.name ?? "lead"}: ${result.level} → ${label}`),
        fields: {
          ...f, ...base, step, index, question, score: result.level, score_reasons: result.reasons.join("; "), confidence, sentiment: analysis!.sentiment,
          reply: analysis!.reply, public_reply: analysis!.public_reply, private_reply: analysis!.private_reply, contact: ready.contact ?? "", need: ready.need ?? "",
          handoff: handoffAlso ? "1" : "", negative: negative ? "1" : "", signals: JSON.stringify(signals), answer: analysis!.answer ?? "",
        },
      },
    };
  },
  perform: async (c, item, p): Promise<Performed> => {
    const flow = await mustFlow(c, item.lead_id);
    const f = p.fields as Record<string, unknown>;
    const step = str(f.step);
    if (step === "escalate") return { summary: p.summary, evidence: "captured", href: leadHref(flow.lead_id), lead_id: flow.lead_id };
    let signals = flow.signals;
    try { signals = { ...flow.signals, ...(JSON.parse(str(f.signals) || "{}") as object) }; } catch { /* keep the stored ones */ }
    const setup = await flowSetup(c);
    const patch: Record<string, unknown> = {
      signals, score: str(f.score) || null, score_reasons: str(f.score_reasons) ? str(f.score_reasons).split("; ") : [], scored_at: now(),
    };
    // The reply to the question that was pending is its answer (one answer per question, kept on the lead).
    if (str(f.source_kind) === "dm" && flow.pending_question !== null) {
      const q = setup.questions[flow.pending_question] ?? "";
      const answer = str(f.answer) || flow.last_user_text || "";
      if (answer) patch.answers = recordAnswer(flow.answers ?? [], flow.pending_question, q, answer, now());
      patch.pending_question = null;
    }
    const sig = signals as { contact?: string | null };
    const c2 = contactIn(sig.contact ?? "");
    if (c2.phone && !flow.phone) patch.phone = c2.phone;
    if (c2.email && !flow.email) patch.email = c2.email;
    if (step === "hold" && flow.state === "new") patch.state = "scored";
    const next = await patchFlow(c.db, flow.id, patch);
    if (flow.lead_id && (c2.phone || c2.email)) {
      const lead = ((await c.db.from("leads").select("phone, email").eq("id", flow.lead_id).maybeSingle()).data ?? null) as { phone: string | null; email: string | null } | null;
      const up: Record<string, unknown> = {};
      if (c2.phone && !lead?.phone) up.phone = c2.phone;
      if (c2.email && !lead?.email) up.email = c2.email;
      if (Object.keys(up).length) await c.db.from("leads").update(up).eq("id", flow.lead_id);
    }
    await logEvidence(c.db, c.ws, {
      lead_id: flow.lead_id, work_item_id: item.id, kind: "lead_gen.scored", actor: LEAD_GEN_ACTOR, summary: p.summary,
      evidence: [str(f.score_reasons), next.answers.length ? `${next.answers.length} câu trả lời` : ""].filter(Boolean).join(" · ") || null,
    });
    return { summary: p.summary, evidence: "captured", href: leadHref(flow.lead_id), lead_id: flow.lead_id };
  },
};

/* ------------------------------------------------------------------ the senders (greet, ask, follow up, close) */

/** Why a direct message did not go out, as one line for the work item. */
const notSent = (c: EngineCtx, reason: string): string => {
  if (reason === "tag_only" || reason === "window") return pick(c, "Ngoài khung 24 giờ: không nhắn.", "Outside the 24-hour window: not sent.");
  if (reason === "no_recipient") return pick(c, "Khách này chưa có tài khoản nhắn được.", "This lead has no account to message.");
  return pick(c, "Chưa kết nối Page để nhắn.", "No connected Page to message through.");
};

type Send = { sent: true } | { sent: false; line: string };

/** Send inside the window, or explain. A real Meta failure (token, permission, rate limit) throws so the work item shows as failed. */
const dmOut = async (c: EngineCtx, item: WorkItem, flow: FlowRow, text: string, o: { readonly offerTag: boolean }): Promise<Send> => {
  const r = await sendToFlow(c, flow, text);
  if (r.ok) return { sent: true };
  if (r.reason === "tag_only" && o.offerTag) {
    // Between 24 hours and 7 days only a person may reply, with the HUMAN_AGENT tag: queue it as an ask-mode action carrying the text.
    await sendCommand(c, {
      from: "lead_gen", to: "lead_gen", command: "message_with_human_agent_tag", reason: "outside_24h", parentId: item.id, chainId: item.chain_id ?? item.id, origin: item.origin, queue: true,
      dedupeKey: `message_with_human_agent_tag:${item.id}`,
      payload: { subject_type: "lead", subject_id: flow.lead_id, lead_id: flow.lead_id, contact: flow.phone ?? flow.email ?? flow.psid ?? flow.igsid ?? "", conversation_id: flow.conversation_id ?? "" },
      seed: { summary: pick(c, `Nhắn ${flow.name ?? "khách"} bằng thẻ nhân viên (quá 24 giờ)`, `Message ${flow.name ?? "the lead"} with the human agent tag (over 24 hours)`), draft: text },
    }).catch((e: unknown) => console.error("lead_gen: tagged message not queued:", e instanceof Error ? e.message : e));
    return { sent: false, line: pick(c, "Quá 24 giờ: đã đề xuất nhắn bằng thẻ nhân viên, chờ người duyệt.", "Over 24 hours: a human-agent-tag message is proposed and waits for a person.") };
  }
  if (r.reason === "window" || r.reason === "tag_only" || r.reason === "no_recipient" || r.reason === "not_connected") return { sent: false, line: notSent(c, r.reason) };
  throw new Error(`Meta: ${r.reason}${r.detail ? ` (${r.detail})` : ""}`);
};

const passThrough = (item: WorkItem): Proposal => ({ ...item.proposal, summary: item.proposal.summary ?? "", fields: item.proposal.fields ?? {} });
const done = (summary: string, flow: FlowRow | null, detail?: string | null): Performed => ({ summary, evidence: "captured", href: leadHref(flow?.lead_id), lead_id: flow?.lead_id ?? null, detail: detail ?? null });

const greet: Performer = {
  prepare: async (c, item) => {
    const flow = await mustFlow(c, item.lead_id);
    const f = (item.proposal.fields ?? {}) as Record<string, unknown>;
    // The turn's reply was composed from the public lens in the brand voice; a manual greet without one uses the plain line.
    const draft = str(f.reply).trim() || item.proposal.draft || lines.greet(loc(c), flow.name);
    return { proposal: { ...passThrough(item), summary: pick(c, `Chào ${flow.name ?? "khách"}`, `Greet ${flow.name ?? "the lead"}`), draft, fields: f as Proposal["fields"] } };
  },
  perform: async (c, item, p) => {
    const flow = await mustFlow(c, item.lead_id);
    if (flow.greeted_at) return done(pick(c, "Đã chào khách này trước đó.", "Already greeted."), flow);
    const text = p.draft ?? "";
    const r = await dmOut(c, item, flow, text, { offerTag: true });
    if (!r.sent) return done(r.line, flow);
    await patchFlow(c.db, flow.id, { state: "qualifying" === flow.state ? flow.state : "greeted", greeted_at: now() });
    return done(pick(c, `Đã chào ${flow.name ?? "khách"}`, `Greeted ${flow.name ?? "the lead"}`), flow, text);
  },
};

const ask: Performer = {
  prepare: async (c, item) => {
    const flow = await mustFlow(c, item.lead_id);
    const f = (item.proposal.fields ?? {}) as Record<string, unknown>;
    const setup = await flowSetup(c);
    const contactAsk = str(f.question_kind) === "contact";
    const index = Number.isFinite(Number(f.index)) ? Number(f.index) : flow.asked;
    const question = contactAsk ? lines.askContact(loc(c)) : str(f.question) || setup.questions[index] || "";
    const draft = question ? composeAsk({ reply: str(f.reply), question, locale: loc(c) }) : "";
    return { proposal: { ...passThrough(item), summary: pick(c, `Hỏi ${flow.name ?? "khách"} câu ${flow.asked + 1}`, `Ask ${flow.name ?? "the lead"} question ${flow.asked + 1}`), draft, fields: { ...f, index, question_kind: contactAsk ? "contact" : "" } as Proposal["fields"] } };
  },
  perform: async (c, item, p) => {
    const flow = await mustFlow(c, item.lead_id);
    const f = p.fields as Record<string, unknown>;
    if (!p.draft) return done(pick(c, "Chủ chưa đặt câu hỏi lọc khách: không có gì để hỏi.", "No qualification question is set: nothing to ask."), flow);
    // At most 4 questions in all, one per turn: a repeated or late command asks nothing more.
    if (flow.asked >= 4) return done(pick(c, "Đã hỏi đủ 4 câu.", "Already asked 4 questions."), flow);
    if (flow.pending_question !== null && str(f.question_kind) !== "contact") return done(pick(c, "Đang chờ khách trả lời câu trước.", "Still waiting for the answer to the previous question."), flow);
    const r = await dmOut(c, item, flow, p.draft, { offerTag: true });
    if (!r.sent) return done(r.line, flow);
    const contactAsk = str(f.question_kind) === "contact";
    await patchFlow(c.db, flow.id, {
      state: "qualifying", asked: flow.asked + 1, pending_question: contactAsk ? null : Number(f.index) || 0, ...(contactAsk ? { contact_asked_at: now() } : {}), ...(flow.greeted_at ? {} : { greeted_at: now() }),
    });
    return done(pick(c, `Đã hỏi câu ${flow.asked + 1} (${clip(str(f.question) || "liên hệ", 60)})`, `Asked question ${flow.asked + 1}`), flow, p.draft);
  },
};

const followUp: Performer = {
  prepare: async (c, item) => {
    const flow = await mustFlow(c, item.lead_id);
    const f = (item.proposal.fields ?? {}) as Record<string, unknown>;
    const draft = [str(f.reply).trim(), lines.followUp(loc(c))].filter(Boolean).join("\n\n");
    return { proposal: { ...passThrough(item), summary: pick(c, `Nhắn lại khách ấm ${flow.name ?? ""}`.trim(), `Follow up warm lead ${flow.name ?? ""}`.trim()), draft, fields: f as Proposal["fields"] } };
  },
  perform: async (c, item, p) => {
    const flow = await mustFlow(c, item.lead_id);
    if (!p.draft?.trim()) return done(pick(c, "Đã nhắn lại khách này trước đó, không có gì thêm để nói.", "Already followed up, nothing to add."), flow);
    const first = !flow.followed_up_at;
    const r = await sendToFlow(c, flow, p.draft);
    if (r.ok) {
      await patchFlow(c.db, flow.id, { state: "nurturing", ...(first ? { followed_up_at: now() } : {}) });
      return done(pick(c, `Đã nhắn lại khách ấm ${flow.name ?? ""}`.trim(), `Followed up ${flow.name ?? "the warm lead"}`), flow, p.draft);
    }
    if (r.reason !== "window" && r.reason !== "tag_only" && r.reason !== "no_recipient" && r.reason !== "not_connected") throw new Error(`Meta: ${r.reason}${r.detail ? ` (${r.detail})` : ""}`);
    // No normal message may go (form lead, mention, window over). A follow-up is marketing, so no tag either: Sales gets it as its own gated follow-up.
    if (!first) return done(notSent(c, r.reason), flow);
    await sendCommand(c, {
      from: "lead_gen", to: "sales", command: "send_follow_up", reason: "warm_lead_outside_window", parentId: item.id, chainId: item.chain_id ?? item.id, origin: item.origin,
      inboundEventId: item.inbound_event_id, queue: true, dedupeKey: `send_follow_up:lead_gen:${flow.id}`, payload: { subject_type: "lead", subject_id: flow.lead_id, lead_id: flow.lead_id },
    }).catch((e: unknown) => console.error("lead_gen: sales follow-up not queued:", e instanceof Error ? e.message : e));
    await patchFlow(c.db, flow.id, { state: "nurturing", followed_up_at: now() });
    return done(pick(c, "Khách ấm ngoài khung 24 giờ: chuyển Sales nhắn lại.", "Warm lead outside the 24-hour window: handed to Sales to follow up."), flow);
  },
};

const close: Performer = {
  prepare: async (c, item) => {
    const flow = await mustFlow(c, item.lead_id);
    const f = (item.proposal.fields ?? {}) as Record<string, unknown>;
    const draft = [str(f.reply).trim(), lines.close(loc(c))].filter(Boolean).join("\n\n");
    return { proposal: { ...passThrough(item), summary: pick(c, `Khép lại với ${flow.name ?? "khách"} (khách lạnh)`, `Close ${flow.name ?? "the lead"} (cold)`), draft, fields: f as Proposal["fields"] } };
  },
  perform: async (c, item, p) => {
    const flow = await mustFlow(c, item.lead_id);
    if (!p.draft?.trim()) return done(pick(c, "Đã khép lại trước đó, không có gì thêm để nói.", "Already closed, nothing to add."), flow);
    const r = await sendToFlow(c, flow, p.draft);
    if (!r.ok && r.reason !== "window" && r.reason !== "tag_only" && r.reason !== "no_recipient" && r.reason !== "not_connected") throw new Error(`Meta: ${r.reason}${r.detail ? ` (${r.detail})` : ""}`);
    // Outside the window the lead is closed silently: nothing is ever sent to a person who has not written in the last 24 hours.
    await patchFlow(c.db, flow.id, { state: "closed", closed_at: now(), pending_question: null });
    return done(r.ok ? pick(c, `Đã khép lại lịch sự với ${flow.name ?? "khách"}`, `Politely closed ${flow.name ?? "the lead"}`) : pick(c, "Khách lạnh, ngoài khung 24 giờ: đóng, không nhắn.", "Cold lead outside the 24-hour window: closed without a message."), flow, r.ok ? p.draft : null);
  },
};

/* ------------------------------------------------------------------ comments */

const pageFor = async (c: EngineCtx, flow: FlowRow, f: Record<string, unknown>) => {
  const connectionId = str(f.connection_id) || flow.connection_id;
  const page = connectionId ? await loadMetaPage(connectionId).catch(() => null) : null;
  if (!page || page.workspaceId !== c.ws) throw new Error(pick(c, "Chưa kết nối Page để trả lời bình luận.", "No connected Page to answer the comment."));
  return page;
};

const publicReply: Performer = {
  prepare: async (c, item) => {
    const flow = await mustFlow(c, item.lead_id);
    const f = (item.proposal.fields ?? {}) as Record<string, unknown>;
    const draft = str(f.public_reply).trim() || lines.publicReply(loc(c));
    const negative = f.negative === "1";
    return { proposal: { ...passThrough(item), summary: negative
      ? pick(c, `Bình luận tiêu cực của ${flow.name ?? "khách"}: duyệt câu trả lời công khai`, `Negative comment from ${flow.name ?? "the lead"}: approve the public reply`)
      : pick(c, `Trả lời công khai bình luận của ${flow.name ?? "khách"}`, `Reply publicly to ${flow.name ?? "the lead"}'s comment`), draft, fields: f as Proposal["fields"] } };
  },
  perform: async (c, item, p) => {
    const flow = await mustFlow(c, item.lead_id);
    const f = p.fields as Record<string, unknown>;
    const commentId = str(f.comment_id);
    if (!commentId) throw new Error(pick(c, "Thiếu mã bình luận.", "Missing comment id."));
    const page = await pageFor(c, flow, f);
    const res = await (flow.platform === "instagram" ? replyToInstagramComment : replyToComment)(page, commentId, p.draft ?? "");
    if (!res.ok) throw new Error(`Meta: ${res.reason}${res.detail ? ` (${res.detail})` : ""}`);
    await sayInConversation(c.db, c.ws, str(f.conversation_id) || flow.conversation_id, "agent", `[trả lời công khai] ${p.draft ?? ""}`, "sent");
    return done(pick(c, `Đã trả lời công khai bình luận của ${flow.name ?? "khách"}`, `Replied publicly to ${flow.name ?? "the lead"}'s comment`), flow, p.draft);
  },
};

const privateReplyPerformer: Performer = {
  prepare: async (c, item) => {
    const flow = await mustFlow(c, item.lead_id);
    const f = (item.proposal.fields ?? {}) as Record<string, unknown>;
    const draft = str(f.private_reply).trim() || lines.privateGreet(loc(c), flow.name);
    return { proposal: { ...passThrough(item), summary: pick(c, `Nhắn riêng cho ${flow.name ?? "người bình luận"}`, `Private reply to ${flow.name ?? "the commenter"}`), draft, fields: f as Proposal["fields"] } };
  },
  perform: async (c, item, p) => {
    const flow = await mustFlow(c, item.lead_id);
    const f = p.fields as Record<string, unknown>;
    const commentId = str(f.comment_id);
    if (!commentId) throw new Error(pick(c, "Thiếu mã bình luận.", "Missing comment id."));
    const page = await pageFor(c, flow, f);
    // meta.ts enforces "once per comment" (an atomic claim) and the 7 day window; a repeat is not an error.
    const res = await (flow.platform === "instagram" ? privateReplyInstagram : privateReply)(page, commentId, p.draft ?? "");
    if (!res.ok) {
      if (res.reason === "already_replied") return done(pick(c, "Bình luận này đã được nhắn riêng trước đó.", "This comment already got its private reply."), flow);
      if (res.reason === "private_reply_expired" || res.reason === "comment_age_unknown") return done(pick(c, "Quá 7 ngày kể từ bình luận: không nhắn riêng được.", "Over 7 days since the comment: no private reply."), flow);
      throw new Error(`Meta: ${res.reason}${res.detail ? ` (${res.detail})` : ""}`);
    }
    // The private message reached a thread: its recipient id is the person's real Messenger / Instagram id (links their later DMs to this lead).
    const patch: Record<string, unknown> = { greeted_at: now(), ...(flow.state === "new" ? { state: "greeted" } : {}) };
    if (res.recipientId) {
      if (flow.platform === "instagram" && !flow.igsid) patch.igsid = res.recipientId;
      if (flow.platform !== "instagram" && !flow.psid) patch.psid = res.recipientId;
    }
    await patchFlow(c.db, flow.id, patch).catch(async () => { delete patch.psid; delete patch.igsid; await patchFlow(c.db, flow.id, patch); });
    await sayInConversation(c.db, c.ws, str(f.conversation_id) || flow.conversation_id, "agent", p.draft ?? "", "sent");
    return done(pick(c, `Đã nhắn riêng cho ${flow.name ?? "người bình luận"}`, `Sent the private reply to ${flow.name ?? "the commenter"}`), flow, p.draft);
  },
};

/* ------------------------------------------------------------------ handoff_to_sales (hot leads only) */

const handoff: Performer = {
  prepare: async (c, item) => {
    const flow = await flowByLead(c.db, c.ws, item.lead_id);
    const f = (item.proposal.fields ?? {}) as Record<string, unknown>;
    const ready = flow ? handoffReady({ ...EMPTY_SIGNALS, ...flow.signals }, flow) : { ok: false, contact: null as string | null, need: null as string | null };
    const hot = (flow?.score ?? str(f.score)) === "hot";
    const lead = item.lead_id ? (((await c.db.from("leads").select("contact_name, need").eq("id", item.lead_id).maybeSingle()).data ?? null) as { contact_name: string; need: string } | null) : null;
    const name = lead?.contact_name ?? flow?.name ?? "";
    return {
      proposal: {
        ...passThrough(item),
        summary: hot ? pick(c, `Chuyển khách nóng ${name} cho Sales`, `Hand hot lead ${name} to Sales`) : pick(c, `Chuyển ${name} cho Sales (khách ${flow?.score === "warm" ? "ấm" : "lạnh"}, cần người duyệt)`, `Hand ${name} to Sales (${flow?.score ?? "unscored"} lead, needs a person)`),
        // Only hot leads go on their own: a warm or cold one is "unclear" to the gate, so it becomes an ask (a person may still choose to hand it over).
        ...(hot ? {} : { outcome: "unclear" as const }),
        fields: { ...f, contact: str(f.contact) || ready.contact || "", need: str(f.need) || ready.need || lead?.need || "", score: flow?.score ?? str(f.score) },
      },
    };
  },
  perform: async (c, item, p) => {
    const flow = await mustFlow(c, item.lead_id);
    const f = p.fields as Record<string, unknown>;
    const pack = handoffNeed({
      need: str(f.need) || null, score: { level: flow.score ?? "hot", reasons: flow.score_reasons ?? [], missing: [] }, answers: flow.answers ?? [], source: flow.source, lastUserAt: flow.last_user_at,
    });
    if (flow.lead_id) {
      const lead = ((await c.db.from("leads").select("need, context_summary").eq("id", flow.lead_id).maybeSingle()).data ?? null) as { need: string; context_summary: string | null } | null;
      await c.db.from("leads").update({ need: pack, ...(lead?.context_summary ? {} : { context_summary: pack }) }).eq("id", flow.lead_id);
    }
    await patchFlow(c.db, flow.id, { state: "handed_off", handed_off_at: now(), pending_question: null });
    const lead = flow.lead_id ? (((await c.db.from("leads").select("*").eq("id", flow.lead_id).maybeSingle()).data ?? null) as Lead | null) : null;
    if (lead) await emitEvent(c.ws, "handoff.requested", { lead_id: lead.id, name: lead.contact_name, company: lead.company, channel: lead.channel, need: lead.need, phone: lead.phone ?? null, email: lead.email ?? null, origin: item.origin, work_item_id: item.id, conversation_id: flow.conversation_id }, `handoff.requested:${item.id}`);
    await logEvidence(c.db, c.ws, { lead_id: flow.lead_id, work_item_id: item.id, kind: "lead_gen.handoff", actor: LEAD_GEN_ACTOR, summary: pick(c, `Chuyển cho Sales (${flow.score ?? "hot"})`, `Handed to Sales (${flow.score ?? "hot"})`), evidence: pack });
    return done(pick(c, `Đã chuyển ${flow.name ?? "khách"} cho Sales`, `Handed ${flow.name ?? "the lead"} to Sales`), flow);
  },
};

/* ------------------------------------------------------------------ message_with_human_agent_tag (ask mode, outside 24 hours) */

const humanAgentTag: Performer = {
  prepare: async (_c, item) => ({ proposal: passThrough(item) }),
  perform: async (c, item, p) => {
    const flow = await mustFlow(c, item.lead_id);
    const r = await sendToFlow(c, flow, p.draft ?? "", { tag: "HUMAN_AGENT" });
    if (!r.ok) throw new Error(r.reason === "window" ? pick(c, "Quá 7 ngày: không thể nhắn kể cả bằng thẻ nhân viên.", "Over 7 days: not even the human agent tag may be used.") : `Meta: ${r.reason}${r.detail ? ` (${r.detail})` : ""}`);
    return done(pick(c, `Đã nhắn ${flow.name ?? "khách"} bằng thẻ nhân viên`, `Messaged ${flow.name ?? "the lead"} with the human agent tag`), flow, p.draft);
  },
};

export const LEAD_GEN_PERFORMERS = {
  capture_lead: capture,
  score_lead: score,
  greet_prospect: greet,
  ask_qualifying: ask,
  follow_up_lead: followUp,
  close_lead: close,
  reply_comment_public: publicReply,
  private_reply_comment: privateReplyPerformer,
  handoff_to_sales: handoff,
  message_with_human_agent_tag: humanAgentTag,
} as const;
