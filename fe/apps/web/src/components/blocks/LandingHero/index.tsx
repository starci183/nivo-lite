import { getLocale, getTranslations } from "next-intl/server"
import { FOUNDING_OFFER, LANDING_ANCHORS } from "@/hooks/landing"
import { CONSOLE_ROUTES } from "@/modules/routes"
import { LandingHeroBase } from "./component"

/** Demo avatars and badge tones of the hero card rows. */
const HERO_ROWS = [
    { id: "first", name: "Minh", badgeTone: "warning" },
    { id: "second", name: "Lan", badgeTone: "success" },
] as const

/** The landing hero with its copy resolved on the server. */
export const LandingHero = async () => {
    const [t, locale] = await Promise.all([getTranslations("landing"), getLocale()])
    return (
        <LandingHeroBase
            props={{
                regionLabel: `${t("heroLine1")} ${t("heroLine2")}`,
                offerBadge: t("heroOffer", { percent: FOUNDING_OFFER.percentOff }),
                titleLines: [t("heroLine1"), t("heroLine2")],
                lead: t("heroLead"),
                ctaLabel: t("heroCta"),
                ctaHref: CONSOLE_ROUTES.login,
                secondaryLabel: t("heroSecondary"),
                secondaryHref: LANDING_ANCHORS.product,
                facts: [t("heroFactNoCard"), t("heroFactSetup"), t("heroFactChannels")],
                tagline: t("tagline"),
                cardTitle: t("heroCardTitle"),
                cardListLabel: t("heroCardAria"),
                rows: HERO_ROWS.map((row, position) => ({
                    id: row.id,
                    name: row.name,
                    title: t(`heroRow${position + 1}Title`),
                    description: t(`heroRow${position + 1}Desc`),
                    badge: t(`heroRow${position + 1}Badge`),
                    badgeTone: row.badgeTone,
                })),
                artSrc: "/images/entry/hero-mascot.png",
                shotSrc: `/images/landing/${locale}/overview.png`,
                shotAlt: t("shotOverview"),
                shotCaption: t("demoLabel"),
            }}
        />
    )
}
