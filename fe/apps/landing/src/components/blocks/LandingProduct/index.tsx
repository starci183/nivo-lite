"use client"

import { useLocale, useTranslations } from "next-intl"
import { useState } from "react"
import { LandingProductBase } from "./component"

/** The five views: screenshot file and size, in tab order. */
const VIEWS = [
    { n: 1, id: "office", file: "office", width: 1184, height: 1020, alt: "shotOffice" },
    { n: 2, id: "context", file: "lead-context", width: 775, height: 620, alt: "shotContext" },
    { n: 3, id: "owner", file: "owner", width: 775, height: 325, alt: "shotOwner" },
    { n: 4, id: "approval", file: "approval", width: 775, height: 565, alt: "shotApproval" },
    { n: 5, id: "outcome", file: "outcome", width: 775, height: 754, alt: "shotOutcome" },
] as const

/** Three benefits per view. */
const BENEFITS = [1, 2, 3] as const

/** The landing product section: the tab state lives here, the drawing in the pure half. */
export const LandingProduct = () => {
    const t = useTranslations("landing")
    const locale = useLocale()
    const [selectedId, setSelectedId] = useState<string>(VIEWS[0].id)
    return (
        <LandingProductBase
            props={{
                headingId: "landing-product",
                eyebrow: t("productEyebrow"),
                title: t("productTitle"),
                tabsLabel: t("tabsLabel"),
                selectedId,
                views: VIEWS.map((view) => ({
                    id: view.id,
                    tabLabel: t(`tab${view.n}`),
                    title: t(`tab${view.n}Title`),
                    bullets: BENEFITS.map((benefit) => t(`tab${view.n}b${benefit}`)),
                    shot: {
                        src: `/images/landing/${locale}/${view.file}.png`,
                        alt: t(view.alt),
                        caption: t("demoLabel"),
                        width: view.width,
                        height: view.height,
                    },
                })),
            }}
            on={{ select: setSelectedId }}
        />
    )
}
