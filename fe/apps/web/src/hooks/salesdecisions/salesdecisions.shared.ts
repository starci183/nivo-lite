import { parseAmount } from "@/hooks/sales"
import type { SalesWorkEditsRequest } from "@/hooks/swr"
import type { SalesDecision } from "@/modules/types"

/** What a person has typed or toggled on the pending cards, by decision id. */
export interface TypedDecisionValues {
    readonly editing: Readonly<Record<string, boolean>>
    readonly drafts: Readonly<Record<string, string>>
    readonly amounts: Readonly<Record<string, string>>
    readonly values: Readonly<Record<string, string>>
}

/** Nothing typed yet. */
export const EMPTY_TYPED: TypedDecisionValues = { editing: {}, drafts: {}, amounts: {}, values: {} }

/** The key of a missing field of one decision. */
export const fieldKey = (id: string, name: string): string => `${id}:${name}`

/** Captures non-empty missing fields and preserves their parsed amount separately. */
const missingEditsOf = (item: SalesDecision, typed: TypedDecisionValues) => {
    const fields: Record<string, string | number | null> = {}
    let amount: number | null | undefined
    for (const name of item.missing) {
        const raw = (typed.values[fieldKey(item.id, name)] ?? "").trim()
        if (!raw) continue
        const value = name === "amount_vnd" ? parseAmount(raw) : raw
        fields[name] = value
        if (name === "amount_vnd") amount = parseAmount(raw)
    }
    return { fields, amount }
}

/** Captures changes in the optional editor without replacing untouched values. */
const editorEditsOf = (item: SalesDecision, typed: TypedDecisionValues) => {
    let draft: string | undefined
    let amount: number | null | undefined
    if (!typed.editing[item.id]) return { draft, amount }
    const typedDraft = (typed.drafts[item.id] ?? item.draft).trim()
    if (typedDraft && typedDraft !== item.draft) draft = typedDraft
    if (item.hasAmount && !item.missing.includes("amount_vnd")) {
        const originalAmount = item.amountVnd === null ? "" : String(item.amountVnd)
        const typedAmount = parseAmount(typed.amounts[item.id] ?? originalAmount)
        if (typedAmount !== item.amountVnd) amount = typedAmount
    }
    return { draft, amount }
}

/** The edits a person made to a pending decision (filled fields, the draft, the amount), or undefined when nothing changed. */
export const editsOf = (item: SalesDecision, typed: TypedDecisionValues): SalesWorkEditsRequest | undefined => {
    const missing = missingEditsOf(item, typed)
    const editor = editorEditsOf(item, typed)
    const amount = editor.amount === undefined ? missing.amount : editor.amount
    const { draft } = editor
    const edits: SalesWorkEditsRequest = {
        ...(draft === undefined ? {} : { draft }),
        ...(amount === undefined ? {} : { amount_vnd: amount }),
        ...(Object.keys(missing.fields).length > 0
            ? {
                  fields: Object.entries(missing.fields).map(([name, value]) =>
                      typeof value === "number" ? { name, number: value } : { name, text: value },
                  ),
              }
            : {}),
    }
    return Object.keys(edits).length > 0 ? edits : undefined
}
