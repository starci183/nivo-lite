import { getLocale, getTranslations } from "next-intl/server"
import { CONSOLE_PAGES, appHref } from "@/modules/routes"
import { LandingFinalCtaBase } from "./component"

/** The landing final call to action with its copy resolved on the server. */
export const LandingFinalCta = async () => {
    const t = await getTranslations("landingBottom")

    const locale = await getLocale()
    return (
        <LandingFinalCtaBase
            props={{
                regionLabel: t("ctaAria"),
                title: t("ctaTitle"),
                text: t("ctaText"),
                buttonLabel: t("ctaButton"),
                buttonHref: appHref(CONSOLE_PAGES.login, locale),
                note: t("ctaNote"),
            }}
        />
    )
}
