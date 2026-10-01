import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import * as ai from "./deepseek";
import { fillBody, type MessageVars, type TemplateDef } from "./automation-shared";
import { loadShopContext } from "./automation-queries";

/**
 * The model's two jobs in automations, both through the existing wrapper (deepseek.ts `draftFollowUp` is its general "write one message" call):
 *   1. personalise: ONCE at enable time, rewrite a template's wording in the shop's tone from its ACTIVE context (the owner reviews it);
 *   2. per case: for `ai_per_case` templates, write one message within the approved body and the guardrails.
 * Both fall back to the deterministic text when the model is unavailable, so an automation never fails only because of the model.
 */
type Db = SupabaseClient;

const WRITER: ai.AgentInput = { name: "NIVO", handle: "nivo", role: "message writer", instructions: "You write short customer messages for a small business, exactly in the owner's voice." };

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
 * `contextText` is the active context of the template's module (summary, facts, gate evidence).
 */
export const proposeBody = async (db: Db, ws: string, def: TemplateDef, contextText: string): Promise<{ body: string; generated: boolean }> => {
  const base = def.defaultBody?.vi ?? "";
  if (!base) return { body: "", generated: false };
  try {
    const instruction = [
      "Rewrite the message template below for THIS shop, in the shop's tone and the way it addresses customers (anh/chị/bạn, em/mình...), taking the style from the shop information.",
      `Keep every placeholder in curly braces EXACTLY as written (${[...placeholdersOf(base)].map((v) => `{${v}}`).join(", ")}), and use no other placeholders. Do not add facts, prices, hours or promises that are not in the shop information.`,
      `Guardrails: ${def.guardrails.map((g) => g.vi).join(" ")}`,
      "Vietnamese. Plain text for a chat app: no markdown, no emojis unless the shop's tone clearly uses them. Max 60 words. Output only the message template.",
    ].join("\n");
    const raw = await ai.draftFollowUp({ contact_name: "{ten_khach}", company: "", channel: "chat", need: "" }, await shopBlock(db, ws, contextText), `${instruction}\n\nTemplate to rewrite:\n${base}`, WRITER);
    const text = stripQuotes(raw);
    return acceptable(text, def, base) ? { body: text, generated: true } : { body: base, generated: false };
  } catch (e) {
    console.error("automation body generation failed:", e instanceof Error ? e.message : e);
    return { body: base, generated: false };
  }
};

/**
 * One message for one case. `fixed`: only the variables are filled (no model call). `ai_per_case`: the model writes it within the approved body and the guardrails
 * (it may adapt to the case but keeps the meaning, the offer and the tone); any problem falls back to the filled body.
 */
export const writeMessage = async (db: Db, ws: string, def: TemplateDef, body: string, vars: MessageVars, caseNote: string): Promise<{ text: string; generated: boolean }> => {
  const filled = fillBody(body, vars);
  if (def.contentMode !== "ai_per_case") return { text: filled, generated: false };
  try {
    const instruction = [
      "Write ONE message to this customer, based on the approved message below: keep its meaning, tone, addressing and any offer, and adapt it lightly to the case.",
      `Guardrails: ${def.guardrails.map((g) => g.vi).join(" ")}`,
      "Vietnamese. Plain text for a chat app: no markdown. Max 70 words. Output only the message.",
      `Approved message:\n${filled}`,
    ].join("\n");
    const raw = await ai.draftFollowUp({ contact_name: vars.ten_khach ?? "bạn", company: "", channel: "chat", need: vars.nhu_cau ?? "" }, await shopBlock(db, ws, ""), `${instruction}\n\nCase: ${caseNote}`, WRITER);
    const text = stripQuotes(raw);
    return text && text.length <= 700 && !/\{[a-z_]+\}/.test(text) ? { text, generated: true } : { text: filled, generated: false };
  } catch (e) {
    console.error("automation message writing failed:", e instanceof Error ? e.message : e);
    return { text: filled, generated: false };
  }
};

/** Is a customer's reply negative? One cheap model call; "unknown" on any failure (never raises a false alarm). */
export const isNegativeFeedback = async (text: string): Promise<boolean> => {
  const t = text.trim();
  if (!t) return false;
  if (/(tệ|dở|chán|thất vọng|không (hài lòng|tốt|ok)|kém|bực|phàn nàn|tồi|lừa|bad|terrible|awful|disappoint|worst)/i.test(t)) return true;
  try {
    const raw = await ai.draftFollowUp({ contact_name: "x", company: "", channel: "chat", need: "" }, "", `Classify the customer's feedback below as exactly one word: POSITIVE, NEUTRAL or NEGATIVE. Output only that word.\n\nFeedback: ${t.slice(0, 500)}`, WRITER);
    return /NEGATIVE/i.test(raw);
  } catch {
    return false;
  }
};
