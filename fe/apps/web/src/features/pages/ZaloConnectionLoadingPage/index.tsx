import type { ReactElement } from "react"
import { getTranslations } from "next-intl/server"
import { CONNECTION_PHASES } from "@/modules/connection-lifecycle"
import { ZaloConnectionLoadingPageBase } from "./component"

/** The loading view of one Zalo OA connection: the frame of the page itself with only what is read unresolved. */
export const ZaloConnectionLoadingPage = async (): Promise<ReactElement> => {
    const t = await getTranslations("zaloConnection")
    const tc = await getTranslations("connections")
    const steps = CONNECTION_PHASES.map((phase) => ({ id: phase, title: tc(`phase_${phase}`) }))
    return (
        <ZaloConnectionLoadingPageBase
            props={{ steps, title: t("title"), mainLabel: t("mainLabel"), railLabel: t("checksTitle") }}
        />
    )
}
