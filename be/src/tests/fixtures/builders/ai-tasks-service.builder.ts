import { z } from "zod"

/** What the AI endpoint answers besides its text, model and usage. */
export const ANSWER = { parsed: null, retrieved: 0 }

/** The usage the AI endpoint reports for one answer. */
export const USAGE = { promptTokens: 12, completionTokens: 5, totalTokens: 17, costUsd: 0.0002 }

/** The structured answer a node's JSON call asks for in the specs: the items it read and their total. */
export const ITEMS_SCHEMA: z.ZodObject<
    { items: z.ZodOptional<z.ZodNullable<z.ZodString>>; amount_vnd: z.ZodOptional<z.ZodNullable<z.ZodNumber>> },
    z.core.$loose
> = z.looseObject({ items: z.string().max(500).nullish(), amount_vnd: z.number().nullish() })

/** What the model reads from free text in the specs. */
export const COMBO_ORDER = { items: "Combo", amount_vnd: 1500000, confidence: 0.9 }

/** A JSON answer with the items named A. */
export const ITEMS_A_JSON = '{"items":"A"}'

/** What the picture reader answers: each address inlined as a PNG data URL of itself, none dropped. */
export const dataUrls = (urls: ReadonlyArray<string>): Promise<{ images: ReadonlyArray<string>; dropped: number }> =>
    Promise.resolve({ images: urls.map((url) => `data:image/png;base64,${url}`), dropped: 0 })
