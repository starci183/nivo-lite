import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { generateText } from "./automation-llm";
import { fillBody, type MessageVars, type TemplateDef } from "./automation-shared";
import { loadShopContext } from "./automation-queries";

/**
 * The model's jobs in automations, all through automation-llm.ts (OpenClaw is the only text-generating AI; its helper is not wired yet, so generation returns
 * null and every function here falls back to deterministic text):
 *   1. proposeBody   ONCE at enable time: the shop's wording from its ACTIVE context (the owner reviews it). Fallback: the frame's default wording.
 *   2. writeMessage  `ai_per_case` templates: one message within the approved body and the guardrails. Fallback: the approved body with its variables filled.
 *   3. isNegativeFeedback  a customer's reply after a review request. Without a model: a keyword check only (no false alarms from silence).
 * An automation never fails only because the model is unavailable.
 */
type Db = SupabaseClient;

const PLACEHOLDER = /\{([a-z_]+)\}/g;
const placeholdersOf = (text: string): Set<string> => new Set([...text.matchAll(PLACEHOLDER)].map((m) => m[1]));

/** The model's text is usable only if it keeps every variable the frame needs, invents none, and is a single plain message. */
const acceptable = (text: string, def: TemplateDef, base: string): boolean => {
  if (!text || text.length > 600 || /\*\*|^#|```/m.test(text)) return false;
  const have = placeholdersOf(text);
  const need = placeholdersOf(base);
  if ([...need].some((v) => !have.has(v))) return false;
  return [...have].every((v) => def.variables.includes(v));
};

const stripQuotes = (s: string) => s.trim().replace(/^["“”']|["“”']$/g, "").trim();

const shopBlock = async (db: Db, ws: string, contextText: string): Promise<string> => {
  const shop = await loadShopContext(db, ws);
  return [`Shop name: ${shop.shop}`, shop.hours ? `Opening hours: ${shop.hours}` : "", shop.tone ? `Tone / brand voice: ${shop.tone}` : "", contextText ? `What the shop told NIVO about itself:\n${contextText.slice(0, 2500)}` : ""].filter(Boolean).join("\n");
};

/**
 * Propose the shop's wording for a template (NOT saved: the owner reviews or edits it, then saves). Keeps every {variable} of the frame's default body.
 * `generated: false` means the frame's default wording is returned (no model, or its answer was not usable).
 */
export const proposeBody = async (db: Db, ws: string, def: TemplateDef, contextText: string): Promise<{ body: string; generated: boolean }> => {
  const base = def.defaultBody?.vi ?? "";
  if (!base) return { body: "", generated: false };
  try {
    const system = [
      "Rewrite the message template for THIS shop, in the shop's tone and the way it addresses customers (anh/chị/bạn, em/mình...), taking the style from the shop information.",
      `Keep every placeholder in curly braces EXACTLY as written (${[...placeholdersOf(base)].map((v) => `{${v}}`).join(", ")}), and use no other placeholders. Do not add facts, prices, hours or promises that are not in the shop information.`,
      `Guardrails: ${def.guardrails.map((g) => g.vi).join(" ")}`,
      "Vietnamese. Plain text for a chat app: no markdown, no emojis unless the shop's tone clearly uses them. Max 60 words. Output only the message template.",
    ].join("\n");
    const raw = await generateText({ workspaceId: ws, purpose: "personalize", system, prompt: `${await shopBlock(db, ws, contextText)}\n\nTemplate to rewrite:\n${base}` });
    const text = raw ? stripQuotes(raw) : "";
    return text && acceptable(text, def, base) ? { body: text, generated: true } : { body: base, generated: false };
  } catch (e) {
    console.error("automation body generation failed:", e instanceof Error ? e.message : e);
    return { body: base, generated: false };
  }
};

/**
 * One message for one case. `fixed`: only the variables are filled (no model call). `ai_per_case`: the model writes it within the approved body and the
 * guardrails (it may adapt to the case but keeps the meaning, the offer and the tone); no model or any problem falls back to the filled body.
 */
export const writeMessage = async (db: Db, ws: string, def: TemplateDef, body: string, vars: MessageVars, caseNote: string): Promise<{ text: string; generated: boolean }> => {
  const filled = fillBody(body, vars);
  if (def.contentMode !== "ai_per_case") return { text: filled, generated: false };
  try {
    const system = [
      "Write ONE message to this customer, based on the approved message: keep its meaning, tone, addressing and any offer, and adapt it lightly to the case.",
      `Guardrails: ${def.guardrails.map((g) => g.vi).join(" ")}`,
      "Vietnamese. Plain text for a chat app: no markdown. Max 70 words. Output only the message.",
    ].join("\n");
    const raw = await generateText({ workspaceId: ws, purpose: "per_case", system, prompt: `${await shopBlock(db, ws, "")}\n\nApproved message:\n${filled}\n\nCase: ${caseNote}` });
    const text = raw ? stripQuotes(raw) : "";
    return text && text.length <= 700 && !/\{[a-z_]+\}/.test(text) ? { text, generated: true } : { text: filled, generated: false };
  } catch (e) {
    console.error("automation message writing failed:", e instanceof Error ? e.message : e);
    return { text: filled, generated: false };
  }
};

const NEGATIVE = /(tệ|dở|chán|thất vọng|không (hài lòng|tốt|ok)|kém|bực|phàn nàn|tồi|lừa|bad|terrible|awful|disappoint|worst)/i;

/** Is a customer's reply negative? A keyword check, then (when a model is available) one classification call; "no" on any doubt (never a false alarm). */
export const isNegativeFeedback = async (text: string, workspaceId = ""): Promise<boolean> => {
  const t = text.trim();
  if (!t) return false;
  if (NEGATIVE.test(t)) return true;
  try {
    const raw = await generateText({ workspaceId, purpose: "classify", system: "Classify the customer's feedback as exactly one word: POSITIVE, NEUTRAL or NEGATIVE. Output only that word.", prompt: t.slice(0, 500) });
    return /NEGATIVE/i.test(raw ?? "");
  } catch {
    return false;
  }
};
