import { parseAmount } from "@/hooks/sales"
import type { SalesWorkEditsInput } from "@/modules/api"
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

/** The edits a person made to a pending decision (filled fields, the draft, the amount), or undefined when nothing changed. */
export const editsOf = (item: SalesDecision, typed: TypedDecisionValues): SalesWorkEditsInput | undefined => {
    const fields: Record<string, string | number | null> = {}
    let amount: number | null | undefined
    let draft: string | undefined
    for (const name of item.missing) {
        const raw = (typed.values[fieldKey(item.id, name)] ?? "").trim()
        if (!raw) continue
        if (name === "amount_vnd") amount = parseAmount(raw)
        fields[name] = name === "amount_vnd" ? parseAmount(raw) : raw
    }
    if (typed.editing[item.id]) {
        const typedDraft = (typed.drafts[item.id] ?? item.draft).trim()
        if (typedDraft && typedDraft !== item.draft) draft = typedDraft
        const typedAmount =
            item.hasAmount && !item.missing.includes("amount_vnd")
                ? parseAmount(typed.amounts[item.id] ?? (item.amountVnd === null ? "" : String(item.amountVnd)))
                : undefined
        if (typedAmount !== undefined && typedAmount !== item.amountVnd) amount = typedAmount
    }
    const edits: SalesWorkEditsInput = {
        ...(draft === undefined ? {} : { draft }),
        ...(amount === undefined ? {} : { amount_vnd: amount }),
        ...(Object.keys(fields).length > 0
            ? {
                  fields: Object.entries(fields).map(([name, value]) =>
                      typeof value === "number" ? { name, number: value } : { name, text: value },
                  ),
              }
            : {}),
    }
    return Object.keys(edits).length > 0 ? edits : undefined
}
