import type { ReactNode } from "react"
import { getTranslations } from "next-intl/server"
import { APP_ROUTES } from "@/modules/routes"
import { CreditsLayoutBase } from "./component"

interface CreditsLayoutProps {
    readonly children: ReactNode
}

/** Resolves static credits page copy around independent connected slots. */
export const CreditsLayout = async (props: CreditsLayoutProps) => {
    const t = await getTranslations("credits")
    return (
        <CreditsLayoutBase
            props={{
                title: t("title"),
                description: t("description"),
                history: t("historyAction"),
                crumbLabel: t("crumbLabel"),
                crumbs: [
                    { id: "home", label: t("crumbHome"), href: APP_ROUTES.dashboard },
                    { id: "credits", label: t("title") },
                ],
            }}
        >
            {props.children}
        </CreditsLayoutBase>
    )
}
