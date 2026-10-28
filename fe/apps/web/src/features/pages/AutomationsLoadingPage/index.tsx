import { getTranslations } from "next-intl/server"
import { AutomationsBoard } from "@/components/blocks/AutomationsBoard"
import { AutomationsHeading } from "@/components/blocks/AutomationsHeading"
import { AutomationsPageLayout } from "@/components/composites/AutomationsPageLayout"
import { AUTOMATION_ROUTES } from "@/modules/routes"

/** The automations page with no data yet: the same heading and links, the cards as skeleton cards. */
export const AutomationsLoadingPage = async () => {
    const t = await getTranslations("automations")
    return (
        <AutomationsHeading>
            <AutomationsPageLayout
                board={<AutomationsBoard layout="page" />}
                advancedLabel={t("advanced")}
                advancedHref={AUTOMATION_ROUTES.developers}
            />
        </AutomationsHeading>
    )
}
