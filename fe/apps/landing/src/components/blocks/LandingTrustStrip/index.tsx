import { getTranslations } from "next-intl/server"
import type { IconGlyphName } from "@/components/leaves/Icon"
import { LandingTrustStripBase } from "./component"

/** The situations the product watches: catalog key and the glyph that names each. */
const CHIPS: ReadonlyArray<{ readonly id: string; readonly icon: IconGlyphName }> = [
    { id: "chip1", icon: "account" },
    { id: "chip2", icon: "send" },
    { id: "chip3", icon: "pending" },
    { id: "chip4", icon: "notification" },
    { id: "chip5", icon: "wallet" },
    { id: "chip6", icon: "review" },
    { id: "chip7", icon: "complete" },
    { id: "chip8", icon: "search" },
    { id: "chip9", icon: "next" },
]

/** The landing trust strip with its copy resolved on the server. */
export const LandingTrustStrip = async () => {
    const t = await getTranslations("landing")
    return (
        <LandingTrustStripBase
            props={{
                lead: t("trustLead"),
                forLabel: t("trustFor"),
                audience: t("trustAudience"),
                sub: t("trustSub"),
                chips: CHIPS.map((chip) => ({ id: chip.id, label: t(chip.id), icon: chip.icon })),
            }}
        />
    )
}
