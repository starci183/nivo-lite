"use client"

import { useTranslations } from "next-intl"
import { LANDING_ANCHORS } from "@/hooks/landing"
import { LandingNavLinksBase } from "./component"

/** Where the anchors live. */
interface LandingNavLinksProps {
    /** Prefix of the in-page anchors; "/" lets another page reach the landing anchors. */
    readonly anchorBase: string
}

/** The in-page anchors of the top bar, with their copy resolved. */
export const LandingNavLinks = (props: LandingNavLinksProps) => {
    const t = useTranslations("landing")
    const anchor = (target: string): string => `${props.anchorBase}${target}`
    return (
        <LandingNavLinksBase
            props={{
                navLabel: t("navLabel"),
                links: [
                    { id: "product", label: t("navProduct"), href: anchor(LANDING_ANCHORS.product) },
                    { id: "how", label: t("navHow"), href: anchor(LANDING_ANCHORS.how) },
                    { id: "founding", label: t("navFounding"), href: anchor(LANDING_ANCHORS.founding) },
                    { id: "faq", label: t("navFaq"), href: anchor(LANDING_ANCHORS.faq) },
                ],
            }}
        />
    )
}
