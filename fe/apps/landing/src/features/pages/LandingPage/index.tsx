import { getTranslations } from "next-intl/server"
import { LandingPageBase } from "./component"

/** The public landing page; the bar reads the sign-in state in the browser. */
export const LandingPage = async () => {
    const t = await getTranslations("landing")
    return <LandingPageBase props={{ mainLabel: t("homeLabel") }} />
}
