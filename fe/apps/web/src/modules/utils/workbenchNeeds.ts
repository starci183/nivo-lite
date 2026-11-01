import type { WorkbenchNeed } from "@/modules/types"

/** The needs of each desk, one entry per thing it cannot show until something is connected. */
const NEEDS: Readonly<Record<string, ReadonlyArray<WorkbenchNeed>>> = {
    chatbot: [{ id: "meta", match: { kind: "providers", providers: ["meta"] } }],
    sales: [{ id: "ads", match: { kind: "providers", providers: ["meta"] } }],
    accounting: [
        { id: "money", match: { kind: "source", flag: "creditsSource" } },
        { id: "invoices", match: { kind: "source", flag: "payablesSource" } },
    ],
}

/** What a desk needs connected for its figures to be complete; a desk with none has none. */
export const workbenchNeedsOf = (module: string): ReadonlyArray<WorkbenchNeed> => NEEDS[module] ?? []

/** What the read models answer: the connected providers, and the tool behind a source (null: none answered; absent: not asked). */
export interface WorkbenchNeedFacts {
    readonly connectedProviders: ReadonlyArray<string>
    readonly sources: { readonly creditsSource?: string | null; readonly payablesSource?: string | null }
}
