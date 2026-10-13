import { getTranslations } from "next-intl/server"
import type { ReactNode } from "react"
import { ConsoleSessionGate } from "@/components/blocks/ConsoleSessionGate"
import { ConsoleLayoutBase } from "./component"

/** What the console route hands the layout: the routed page. */
type ConsoleLayoutProps = {
    readonly children: ReactNode
}

/** The authenticated console frame: draws the chrome around the routed page; its connected blocks read the session and the real counts. */
export const ConsoleLayout = async (props: ConsoleLayoutProps) => {
    const t = await getTranslations("shell")
    return (
        <ConsoleSessionGate>
            <ConsoleLayoutBase
                props={{ mainNavigationLabel: t("mainNavigation"), workspaceLabel: t("groupWorkspace") }}
            >
                {props.children}
            </ConsoleLayoutBase>
        </ConsoleSessionGate>
    )
}
