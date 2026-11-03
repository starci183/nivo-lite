import { getTranslations } from "next-intl/server"
import type { ReactNode, ReactElement } from "react"
import { ConsoleLayoutBase } from "./component"

/** What the console route hands the layout: the routed page. */
type ConsoleLayoutProps = {
    readonly children: ReactNode
}

/** The authenticated console frame: draws the chrome around the routed page; its connected blocks read the session and the real counts. */
export const ConsoleLayout = async (props: ConsoleLayoutProps): Promise<ReactElement> => {
    const t = await getTranslations("shell")
    return (
        <ConsoleLayoutBase
            props={{
                mainNavigationLabel: t("mainNavigation"),
                workspaceLabel: t("groupWorkspace"),
                drawer: {
                    title: t("mainNavigation"),
                    openLabel: t("openMenu"),
                    closeLabel: t("closeMenu"),
                },
            }}
        >
            {props.children}
        </ConsoleLayoutBase>
    )
}
