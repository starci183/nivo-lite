import type { useFormatter, useTranslations } from "next-intl"
import type { DecisionKind, DecisionOutcome } from "@/modules/types"
import { CONSOLE_ROUTES } from "@/modules/routes"

/** The badge tone of a decision outcome. */
export const outcomeTone = (outcome: DecisionOutcome): "success" | "accent" | "warning" | "danger" => {
    if (outcome === "auto_done" || outcome === "completed") return "success"
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

/** The translators and formatter the rows of the history are worded with. */
export interface DecisionWords {
    readonly t: ReturnType<typeof useTranslations>
    readonly g: ReturnType<typeof useTranslations>
    readonly format: ReturnType<typeof useFormatter>
    readonly now: Date
    /** The workspace the links of the rows lead within. */
    readonly workspaceId: string
}
