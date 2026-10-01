import "server-only";
import { serverConfig } from "./config";
import type { Locale } from "@/i18n/core";
import { businessKnowledgeBrief, setupKnowledgeText } from "./knowledge/index";
import { MODULE_GATES, gateEntry, type DraftSnapshot, type GateEvidence, type ModuleKey, type SetupFact } from "./modules-shared";

/** One turn of the setup chat as the model sees it. */
export type SetupTurnInput = {
  moduleKey: ModuleKey;
  locale: Locale;
  draft: DraftSnapshot;
  gates: GateEvidence;
  /** Earlier messages, oldest first (the new user message is NOT included). */
  history: Array<{ role: "user" | "assistant"; body: string }>;
  message: string;
};

/** What the model returns for one turn. */
export type SetupTurnResult = {
  reply: string;
  summary?: string;
  facts: SetupFact[];
  gates: Record<string, { status: "proposed"; evidence: string }>;
};

const PURPOSE: Record<ModuleKey, string> = {
  chatbot: "a customer care chatbot that answers customers from the owner's knowledge, captures leads and hands them over to Sales",
  sales: "a sales assistant that follows up leads, proposes next steps and drafts messages for the owner to approve",
  accounting: "an accounting assistant that drafts invoices from won deals, matches payments and reminds about receivables",
};

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

const parseLoose = (raw: string): unknown => {
  const text = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
  try { return JSON.parse(text); } catch { /* try the embedded object */ }
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start >= 0 && end > start) {
    try { return JSON.parse(text.slice(start, end + 1)); } catch { /* fall through */ }
  }
  return null;
};

const clean = (v: unknown, max: number): string => (typeof v === "string" ? v.trim().slice(0, max) : "");

/** ONE model call for a setup chat turn: the reply to the owner plus what NIVO learned (facts and proposed gate evidence). */
export const runSetupTurn = async (input: SetupTurnInput): Promise<SetupTurnResult> => {
  const { moduleKey, locale } = input;
  const gates = MODULE_GATES[moduleKey];
  const lang = locale === "vi" ? "Vietnamese (natural, warm business Vietnamese; address the owner as 'bạn')" : "English";
  const gateLines = gates.map((g) => {
    const e = gateEntry(input.gates, g.key);
    return `- ${g.key} | ${g.label_en} | ${g.hint_en} | state: ${e.status}${e.evidence ? ` | evidence: ${e.evidence.slice(0, 300)}` : ""}`;
  }).join("\n");
  // Continuous QA: NIVO's own checklist + authority for this module, and what the owner already wrote in Tri thức.
  const [nivoSetup, business] = await Promise.all([
    setupKnowledgeText(moduleKey).catch(() => ""),
    businessKnowledgeBrief(moduleKey, input.message).catch(() => ({ text: "", sourceCount: 0, notApplicable: [] as Array<string> })),
  ]);
  const factLines = input.draft.facts.map((f) => `- ${f.key}: ${f.text}`).join("\n") || "(none yet)";

  const system = [
    "You are NIVO, the setup assistant of a small-business operating system. You are setting up " + PURPOSE[moduleKey] + ".",
    "The owner is not technical. Talk in plain business language: no jargon, no mention of prompts, models or JSON.",
    `Write the reply in ${lang}.`,
    "Your job each turn: (1) learn from what the owner just said, (2) record it, (3) work out what is STILL missing and ask ONE focused next question.",
    "This is continuous QA, not a form: before asking anything, check what is already known. An item is covered when it has evidence in the gates below, a matching fact, an answer in the owner's business knowledge, or the owner said it does not apply.",
    "",
    "Setup checklist (gates). Every gate must end up confirmed by the owner:",
    gateLines,
    "",
    nivoSetup ? "NIVO's own knowledge for this module (what a complete setup must contain, and the limits of what the AI may do). Use it to decide what to ask and how concrete the answer must be:\n" + nivoSetup : "",
    "",
    business.text,
    "",
    "Facts already noted:",
    factLines,
    "Summary so far: " + (input.draft.summary || "(none)"),
    "",
    "Rules:",
    "- Only record what the owner actually said. Never invent prices, hours, names or policies.",
    "- For each gate the owner's message gives information for, return it under \"gates\" with status \"proposed\" and an evidence statement: a faithful, concise restatement of what the owner said (max 400 characters, owner's language). Merge with earlier evidence if it extends it.",
    "- Do not return gates already confirmed unless the owner clearly changed them.",
    "- NEVER ask something the business knowledge above already answers. Instead, return the gate as proposed with evidence that restates it and starts with the document name (for example: 'Theo tài liệu \"<title>\": ...'), and ask the owner only to confirm it on the right.",
    "- Not every business has every item. If the owner says an item does not apply (for example 'bên em không có bảng giá', 'chưa dùng Zalo', 'không xuất hóa đơn'), accept it: return that gate as proposed with evidence starting with 'Không áp dụng:' (or 'Not applicable:') plus their reason, and never ask about it again. Items listed above as not applicable or dismissed count as covered too.",
    "- When the answer is long-form (a price list, policies, a process document), do not make the owner type it in chat: suggest adding it as a source in Tri thức (menu Tri thức, 'Thêm tri thức') and move on to the next item after they add it.",
    "- Never invent a checklist item that the NIVO knowledge and the gates do not mention.",
    "- \"facts\": short stable items worth remembering (key in snake_case, text max 200 characters). Reuse an existing key to update it.",
    "- \"summary\": 1-3 sentences describing the business, updated with new information.",
    "- \"reply\": max 80 words. Briefly acknowledge the answer, then ask ONE question about the next missing or unclear gate (use its hint to ask concretely; pick the item that blocks the most). If every gate has evidence, say what is left to confirm on the right and that once all are confirmed they should review and press \"Áp dụng\" (\"Apply\" in English).",
    "",
    "Return ONLY a JSON object: {\"reply\": string, \"summary\": string, \"facts\": [{\"key\": string, \"text\": string}], \"gates\": {\"<gateKey>\": {\"status\": \"proposed\", \"evidence\": string}}}",
    "Valid gate keys: " + gates.map((g) => g.key).join(", "),
  ].join("\n");

  const { deepseekApiKey, deepseekModel, deepseekBaseUrl } = serverConfig();
  const res = await fetch(`${deepseekBaseUrl}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${deepseekApiKey}`, "X-Title": "NIVO OS" },
    body: JSON.stringify({
      model: deepseekModel,
      messages: [
        { role: "system", content: system },
        ...input.history.slice(-16).map((m) => ({ role: m.role, content: m.body })),
        { role: "user", content: input.message },
      ],
      temperature: 0.3,
      response_format: { type: "json_object" },
      ...(deepseekBaseUrl.includes("openrouter.ai") ? { reasoning: { enabled: false } } : {}),
    }),
    cache: "no-store",
  });
  if (!res.ok) {
    console.error(`setup model provider ${res.status}: ${(await res.text()).slice(0, 300)}`);
    throw new Error(locale === "vi" ? "AI đang tạm thời không phản hồi. Bạn thử lại sau ít phút nhé." : "The AI is temporarily unavailable. Please try again in a few minutes.");
  }
  const body = (await res.json()) as { choices: Array<{ message: { content: string } }> };
  const raw = body.choices[0]?.message.content?.trim() ?? "";
  const parsed = parseLoose(raw);
  if (!isObject(parsed)) return { reply: raw || (locale === "vi" ? "Bạn kể thêm giúp mình nhé." : "Please tell me a bit more."), facts: [], gates: {} };

  const validKeys = new Set(gates.map((g) => g.key));
  const outGates: SetupTurnResult["gates"] = {};
  if (isObject(parsed.gates)) {
    for (const [key, value] of Object.entries(parsed.gates)) {
      if (!validKeys.has(key) || !isObject(value)) continue;
      const evidence = clean(value.evidence, 500);
      if (evidence) outGates[key] = { status: "proposed", evidence };
    }
  }
  const facts: SetupFact[] = [];
  if (Array.isArray(parsed.facts)) {
    for (const f of parsed.facts) {
      if (!isObject(f)) continue;
      const key = clean(f.key, 60).toLowerCase().replace(/[^a-z0-9_]+/g, "_").replace(/^_+|_+$/g, "");
      const text = clean(f.text, 300);
      if (key && text) facts.push({ key, text });
    }
  }
  const summary = clean(parsed.summary, 600);
  const reply = clean(parsed.reply, 1500) || (locale === "vi" ? "Mình đã ghi lại. Bạn kể thêm nhé." : "Noted. Tell me more.");
  return { reply, ...(summary ? { summary } : {}), facts, gates: outGates };
};

/** Merge a turn into the draft and the gate evidence. Confirmed gates are never overwritten by the model: the owner reopens them. */
export const mergeSetupTurn = (draft: DraftSnapshot, gates: GateEvidence, turn: SetupTurnResult): { draft: DraftSnapshot; gates: GateEvidence } => {
  const facts = [...draft.facts];
  for (const f of turn.facts) {
    const at = facts.findIndex((x) => x.key === f.key);
    if (at >= 0) facts[at] = f; else facts.push(f);
  }
  const nextGates: GateEvidence = { ...gates };
  for (const [key, g] of Object.entries(turn.gates)) {
    if (nextGates[key]?.status === "confirmed") continue;
    nextGates[key] = { status: "proposed", evidence: g.evidence };
  }
  return { draft: { summary: turn.summary ?? draft.summary, facts: facts.slice(-60) }, gates: nextGates };
};
