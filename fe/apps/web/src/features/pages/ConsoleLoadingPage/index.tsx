import { getTranslations } from "next-intl/server"
import { ConsoleLoadingPageBase } from "./component"

/** STATE-8 case-5, last resort: the skeleton of a console route that has no loading view of its own. */
export const ConsoleLoadingPage = async () => {
    const t = await getTranslations("shell")
    return (
        <ConsoleLoadingPageBase
            props={{ crumbLabel: t("crumbLabel"), crumbHome: t("crumbHome"), loading: t("loading") }}
        />
    )
}
