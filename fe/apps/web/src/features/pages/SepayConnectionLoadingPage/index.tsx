import type { ReactElement } from "react"
import { getTranslations } from "next-intl/server"
import { CONNECTION_PHASES } from "@/modules/connection-lifecycle"
import { SepayConnectionLoadingPageBase } from "./component"

/** The loading view of one SePay connection: the frame of the page itself with only what is read unresolved. */
export const SepayConnectionLoadingPage = async (): Promise<ReactElement> => {
    const t = await getTranslations("sepayConnection")
    const tc = await getTranslations("connections")
    const steps = CONNECTION_PHASES.map((phase) => ({ id: phase, title: tc(`phase_${phase}`) }))
    return (
        <SepayConnectionLoadingPageBase
            props={{ steps, title: t("title"), mainLabel: t("mainLabel"), railLabel: t("eventsTitle") }}
        />
    )
}
