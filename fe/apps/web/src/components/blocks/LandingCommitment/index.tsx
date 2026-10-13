import { getTranslations } from "next-intl/server"
import { LandingCommitmentBase } from "./component"

/** The approved NIVO mark raster used as the author's decorative avatar. */
const AUTHOR_MARK_SRC = "/brand/nivo-mark.png"

/** The landing commitment section with its copy resolved on the server. */
export const LandingCommitment = async () => {
    const t = await getTranslations("landingBottom")
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
