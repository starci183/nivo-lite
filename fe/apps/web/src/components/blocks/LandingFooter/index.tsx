import { getTranslations } from "next-intl/server"
import { LANDING_ANCHORS } from "@/hooks/landing"
import { CONSOLE_ROUTES } from "@/modules/routes"
import { LandingFooterBase } from "./component"

/** Where the footer sits relative to the landing anchors. */
interface LandingFooterProps {
    /** Prefix of the in-page anchors; "/" lets another page reach the landing anchors. */
    readonly anchorBase: string
}

/** The approved NIVO logo raster. */
const LOGO_SRC = "/brand/nivo-logo.png"

/** The footer directories: catalog title key and the link keys with the destination each one opens. */
const COLUMNS = [
    {
        id: "colProduct",
        links: [
            ["linkTry", "login"],
            ["linkProduct", "product"],
            ["linkFounding", "founding"],
        ],
    },
    {
        id: "colCompany",
        links: [
            ["linkPrinciples", "commitment"],
            ["linkFaq", "faq"],
            ["linkSignIn", "login"],
        ],
    },
    {
        id: "colSupport",
        links: [
            ["linkFaq", "faq"],
            ["linkStart", "login"],
            ["linkTerms", "faq"],
            ["linkPrivacy", "privacy"],
            ["linkTos", "terms"],
        ],
    },
] as const

/** The landing footer with its copy resolved on the server. */
export const LandingFooter = async (props: LandingFooterProps) => {
    const t = await getTranslations("landingBottom")
    const hrefs = {
        login: CONSOLE_ROUTES.login,
        privacy: CONSOLE_ROUTES.privacy,
        terms: CONSOLE_ROUTES.terms,
        product: `${props.anchorBase}${LANDING_ANCHORS.product}`,
        founding: `${props.anchorBase}${LANDING_ANCHORS.founding}`,
        commitment: `${props.anchorBase}${LANDING_ANCHORS.commitment}`,
        faq: `${props.anchorBase}${LANDING_ANCHORS.faq}`,
    }
    return (
        <LandingFooterBase
            props={{
                label: t("footerAria"),
                homeHref: `${props.anchorBase}${LANDING_ANCHORS.top}`,
                homeLabel: t("footerHome"),
                logoSrc: LOGO_SRC,
                about: t("footerAbout"),
                tagline: t("footerTagline"),
                groups: COLUMNS.map((column) => ({
                    id: column.id,
                    label: t(column.id),
                    links: column.links.map(([key, destination]) => ({
                        id: `${column.id}-${key}`,
                        label: t(key),
                        href: hrefs[destination],
                    })),
                })),
                copyright: t("footerCopyright"),
                legalLine: t("footerLegal"),
                legalNote: t("footerLegalNote"),
            }}
        />
    )
}
