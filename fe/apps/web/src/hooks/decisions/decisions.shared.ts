import type { DecisionKind, DecisionOutcome } from "@/modules/types"
import { CONSOLE_ROUTES } from "@/modules/routes"

/** The filters of the history by who decided, in the order the tabs show them. */
export const DECISION_KINDS: ReadonlyArray<DecisionKind> = ["policy", "human", "rejected"]

/** How many decisions the history reads at most. */
export const DECISIONS_LIMIT = 100

/** The message key of each kind filter. */
export const KIND_KEYS: Readonly<Record<DecisionKind, string>> = {
    policy: "kindPolicy",
    human: "kindHuman",
    rejected: "kindRejected",
}

/** The kind a query-string value names, or none. */
export const kindOf = (value: string): DecisionKind | null => DECISION_KINDS.find((kind) => kind === value) ?? null

/** The badge tone of a decision outcome. */
export const outcomeTone = (outcome: DecisionOutcome): "success" | "accent" | "warning" | "danger" => {
    if (outcome === "auto_done") return "success"
    if (outcome === "approved") return "accent"
    if (outcome === "edited") return "warning"
    return "danger"
}

/** The history address for one pair of filters. */
export const decisionsHref = (kind: DecisionKind | null, department: string | null): string => {
    const query = new URLSearchParams()
    if (kind !== null) query.set("kind", kind)
    if (department !== null) query.set("dept", department)
    const text = query.toString()
    return text === "" ? CONSOLE_ROUTES.decisions : `${CONSOLE_ROUTES.decisions}?${text}`
}

/** The written basis of a decision note and what remains of it. */
export interface NoteParts {
    readonly basis: string | null
    readonly rest: string | null
}

const BASIS_PATTERN = /^(?:Căn cứ|Basis):\s*([\s\S]+)$/ // vn-ok: matches the stored vi prefix of the basis note

/** Splits the owner's written basis out of a decision note; any other note is returned whole as the rest. */
export const splitBasis = (note: string | null): NoteParts => {
    if (note === null || note === "") return { basis: null, rest: null }
    const match = BASIS_PATTERN.exec(note.trim())
    return match === null ? { basis: null, rest: note } : { basis: match[1].trim(), rest: null }
}
