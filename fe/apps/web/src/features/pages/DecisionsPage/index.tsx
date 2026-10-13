import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { decisionKindOf } from "@/hooks/decisions"
import { MODULE_KEYS } from "@/modules/catalog"
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

/** The decision history route: the filters of the query string go to the connected board, which reads the history in the browser. */
export const DecisionsPage = (props: DecisionsPageProps) => {
    const kind = decisionKindOf(props.kind)
    const department = MODULE_KEYS.find((module) => module === props.department) ?? null
    return <DecisionsPageBase props={{ departments: MODULE_KEYS, kind, department }} />
}
