import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { AutomationsBoard } from "@/components/blocks/AutomationsBoard"
import { AutomationsHeading } from "@/components/blocks/AutomationsHeading"
import { AutomationsPageLayout } from "@/components/composites/AutomationsPageLayout"
import { AUTOMATION_ROUTES } from "@/modules/routes"

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
export const AutomationsPage = async (props: AutomationsPageProps) => {
    const t = await getTranslations("automations")
    return (
        <AutomationsPageLayout
            heading={<AutomationsHeading />}
            board={<AutomationsBoard layout="page" {...(props.focus === undefined ? {} : { focus: props.focus })} />}
            advancedLabel={t("advanced")}
            advancedHref={AUTOMATION_ROUTES.developers}
        />
    )
}
