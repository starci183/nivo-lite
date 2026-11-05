import type { ReactElement } from "react"
import { getTranslations } from "next-intl/server"
import { SepayConnectionLoadingPageBase } from "./component"

const STEPS = ["stepEnvironment", "stepAccount", "stepPaste", "checklistTitle", "stepAgents"] as const

/** The loading view of one SePay connection: the frame of the page itself with only what is read unresolved. */
export const SepayConnectionLoadingPage = async (): Promise<ReactElement> => {
    const t = await getTranslations("sepayConnection")
    return (
        <SepayConnectionLoadingPageBase
            props={{
                title: t("title"),
                mainLabel: t("mainLabel"),
                railLabel: t("eventsTitle"),
                steps: STEPS.map((key) => ({ id: key, title: t(key) })),
            }}
        />
    )
}
