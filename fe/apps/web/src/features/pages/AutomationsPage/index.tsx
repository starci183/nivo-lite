import type { ReactElement } from "react"
import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { AutomationsPageBase } from "./component"

/** The document title of the page. */
export const automationsMetadata = async (): Promise<Metadata> => {
    const t = await getTranslations("automations")
    return { title: t("title") }
}

/** Props for the automations page. */
interface AutomationsPageProps {
    /** `?focus=<key>` opens that card. */
    readonly focus?: string | undefined
}

/**
 * The Automations page: ready-made jobs the owner switches on. The heading and the board are connected client blocks that
 * read the back end through SWR; staff see the friendly 403 the board draws when the back end refuses.
 */
export const AutomationsPage = (props: AutomationsPageProps): ReactElement => (
    <AutomationsPageBase props={{ focus: props.focus }} />
)
