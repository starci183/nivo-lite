import { getTranslations } from "next-intl/server"
import { LandingPageBase } from "./component"

import type { ReactElement } from "react"

/** The public landing page; the bar reads the sign-in state in the browser. */
export const LandingPage = async (): Promise<ReactElement> => {
    const t = await getTranslations("landing")
    return <LandingPageBase props={{ mainLabel: t("homeLabel") }} />
}
