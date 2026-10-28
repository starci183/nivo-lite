"use client"

import { useTranslations } from "next-intl"
import { useState } from "react"
import { SepayConsoleBase } from "./component"
import type { SepayConsoleShape } from "./component"

/** What the page hands the console: the regions already connected to the connection of the url. */
type SepayConsoleProps = { readonly shape: SepayConsoleShape }

/** Holds the open tab of the SePay connection page. */
export const SepayConsole = (props: SepayConsoleProps) => {
    const t = useTranslations("sepayConnection")
    const [selected, setSelected] = useState("overview")
    return (
        <SepayConsoleBase
            shape={props.shape}
            props={{
                tabsLabel: t("tabsLabel"),
                tabs: [
                    { id: "overview", label: t("tabOverview") },
                    { id: "setup", label: t("tabSetup") },
                    { id: "test", label: t("tabTest") },
                    { id: "agents", label: t("tabAgents") },
                ],
                selected,
            }}
            on={{ select: setSelected }}
        />
    )
}
