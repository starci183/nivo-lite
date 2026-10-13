"use client"

import { useTranslations } from "next-intl"
import { useConnectionOverlays } from "@/hooks/connections"
import { ConnectionViewTabsBase } from "./component"

/** What the page hands the tabs. */
type ConnectionViewTabsProps = {
    readonly selected: "connected" | "library"
    /** How many connections run; absent while the page loads (STATE-8: the tab keeps its plain label). */
    readonly liveCount?: number
}

/** The Connected / Library tabs; the selected tab lives in the URL so the page renders the right view. */
export const ConnectionViewTabs = (props: ConnectionViewTabsProps) => {
    const t = useTranslations("connections")
    const overlays = useConnectionOverlays()
    return (
        <ConnectionViewTabsBase
            props={{
                label: t("title"),
                selected: props.selected,
                connectedLabel:
                    props.liveCount === undefined ? t("tabConnected") : `${t("tabConnected")} · ${props.liveCount}`,
                libraryLabel: t("tabLibrary"),
            }}
            on={{ select: (id) => overlays.setTab(id === "library" ? "library" : "connected") }}
        />
    )
}
