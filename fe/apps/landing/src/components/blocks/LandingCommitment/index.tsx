"use client"

import { useTranslations } from "next-intl"
import { LandingCommitmentBase } from "./component"

/** The approved NIVO mark raster used as the author's decorative avatar. */
const AUTHOR_MARK_SRC = "/brand/nivo-mark.png"

/**
 * The landing commitment section. The Grammar parts it draws read the loading region (a client context), so the block
 * resolves its copy in the browser bundle, like the other landing blocks that hold Grammar parts.
 */
export const LandingCommitment = () => {
    const t = useTranslations("landingBottom")
    return (
        <LandingCommitmentBase
            props={{
                regionLabel: t("commitAria"),
                eyebrow: t("commitEyebrow"),
                titleLines: t("commitTitle").split("\n"),
                panelLabel: t("commitPanelLabel"),
                panelText: t("commitPanelText"),
                author: t("commitAuthor"),
                authorRole: t("commitAuthorRole"),
                authorMarkSrc: AUTHOR_MARK_SRC,
                quote: t("commitQuoteMarked", { quote: t("commitQuote") }),
                aiChip: t("commitAiChip"),
                aiNote: t("commitAiNote"),
                principles: [
                    { id: "first", title: t("principle1Title"), text: t("principle1Text") },
                    { id: "second", title: t("principle2Title"), text: t("principle2Text") },
                ],
            }}
        />
    )
}
