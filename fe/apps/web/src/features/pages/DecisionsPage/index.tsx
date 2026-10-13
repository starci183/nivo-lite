import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { DECISIONS_LIMIT, kindOf } from "@/hooks/decisions"
import { loadingSlot } from "@/hooks/slot"
import { getSession } from "@/lib/session"
import { MODULE_KEYS } from "@/modules/catalog"
import { readDecisions } from "@/modules/db"
import { toSlot } from "@/modules/slot"
import { DecisionsPageBase } from "./component"

/** What the route passes: the filters of the query string, as text. */
interface DecisionsPageProps {
    readonly kind: string
    readonly department: string
}

/** The document title of the decision history. */
export const decisionsPageMetadata = async (): Promise<Metadata> => {
    const t = await getTranslations("decisions")
    return { title: t("title") }
}

/** The decision history of the active workspace. A failed read reaches the route error boundary. */
export const DecisionsPage = async (props: DecisionsPageProps) => {
    const session = await getSession()
    const kind = kindOf(props.kind)
    const department = MODULE_KEYS.find((module) => module === props.department) ?? null
    const decisions = await readDecisions(session.workspace.id, { kind, department, limit: DECISIONS_LIMIT })
    if (decisions.kind !== "ok") throw new Error(`decisions: ${decisions.kind} ${decisions.code}`)
    return <DecisionsPageBase props={{ decisions: toSlot(decisions), departments: MODULE_KEYS, kind, department }} />
}

/** The decision history with no data yet: the same heading and filters, the list as skeleton rows. */
export const DecisionsLoadingPage = () => (
    <DecisionsPageBase props={{ decisions: loadingSlot(), departments: MODULE_KEYS, kind: null, department: null }} />
)
