import type { TemplateDefinition } from "@modules/domain/automation-templates"
import type { ShopContext } from "../automations.contracts"
import { placeholdersOf } from "./config.policy"

const CONTEXT_MAX = 2500

/** The shop facts a model is given: name, hours, tone and what the shop said about itself. */
export const shopBlock = (shop: ShopContext, contextText: string): string =>
    [
        `Shop name: ${shop.shop}`,
        shop.hours ? `Opening hours: ${shop.hours}` : "",
        shop.tone ? `Tone / brand voice: ${shop.tone}` : "",
        contextText ? `What the shop told NIVO about itself:\n${contextText.slice(0, CONTEXT_MAX)}` : "",
    ]
        .filter(Boolean)
        .join("\n")

/** The instructions that make a model write the shop's own wording of a template, once, when the owner switches it on. */
export const proposalSystem = (def: TemplateDefinition, base: string): string => {
    const placeholders = [...placeholdersOf(base)].map((name) => `{${name}}`).join(", ")
    return [
        "Rewrite the message template for THIS shop, in the shop's tone and the way it addresses customers (anh/chi/ban, em/minh...), taking the style from the shop information.",
        `Keep every placeholder in curly braces EXACTLY as written (${placeholders}), and use no other placeholders. Do not add facts, prices, hours or promises that are not in the shop information.`,
        `Guardrails: ${def.guardrails.map((guardrail) => guardrail.vi).join(" ")}`,
        "Vietnamese. Plain text for a chat app: no markdown, no emojis unless the shop's tone clearly uses them. Max 60 words. Output only the message template.",
    ].join("\n")
}

/** The instructions that make a model write ONE message to one customer inside the approved wording. */
export const caseSystem = (def: TemplateDefinition): string =>
    [
        "Write ONE message to this customer, based on the approved message: keep its meaning, tone, addressing and any offer, and adapt it lightly to the case.",
        `Guardrails: ${def.guardrails.map((guardrail) => guardrail.vi).join(" ")}`,
        "Vietnamese. Plain text for a chat app: no markdown. Max 70 words. Output only the message.",
    ].join("\n")

/** The instructions that make a model label a customer's feedback. */
export const CLASSIFY_SYSTEM =
    "Classify the customer's feedback as exactly one word: POSITIVE, NEUTRAL or NEGATIVE. Output only that word."

/** How much of a customer's feedback a model reads. */
export const FEEDBACK_MAX = 500
