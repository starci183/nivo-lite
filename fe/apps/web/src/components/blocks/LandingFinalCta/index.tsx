import { getTranslations } from "next-intl/server"
import { CONSOLE_ROUTES } from "@/modules/routes"
import { LandingFinalCtaBase } from "./component"

/** The landing final call to action with its copy resolved on the server. */
export const LandingFinalCta = async () => {
    const t = await getTranslations("landingBottom")
    return (
        <LandingFinalCtaBase
            props={{
                regionLabel: t("ctaAria"),
                title: t("ctaTitle"),
                text: t("ctaText"),
                buttonLabel: t("ctaButton"),
                buttonHref: CONSOLE_ROUTES.login,
                note: t("ctaNote"),
            }}
        />
    )
}
