import { getTranslations } from "next-intl/server"
import { ContentWorkbenchPageBase } from "./component"

/** Address inputs passed by the route to the content workbench. */
interface ContentWorkbenchPageProps {
    readonly tab?: string | null
    readonly focus?: string | null
    readonly installationId?: string | null
}

/** Server shell of the content workbench: words the tabs and hands the ids; every block below it reads its own data in the browser. */
export const ContentWorkbenchPage = async (props: ContentWorkbenchPageProps) => {
    const t = await getTranslations("content")
    return (
        <ContentWorkbenchPageBase
            props={{
                installationId: props.installationId ?? null,
                initialTab: props.tab ?? null,
                focus: props.focus ?? null,
                tabs: {
                    calendar: t("tabCalendar"),
                    list: t("tabList"),
                    queue: t("tabQueue"),
                    balance: t("tabBalance"),
                    settings: t("tabSettings"),
                },
            }}
        />
    )
}
