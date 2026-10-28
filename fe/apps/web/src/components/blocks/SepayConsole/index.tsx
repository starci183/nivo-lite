"use client"

import { useSepayTab } from "@/hooks/sepayConnection"
import { SepayConsoleBase } from "./component"
import type { SepayConsoleShape } from "./component"

/** What the page hands the console: the regions already connected to the connection of the url, and the tab the url asked for. */
type SepayConsoleProps = {
    readonly shape: SepayConsoleShape
    readonly connectionId: string
    readonly tab: string | undefined
}

/** Places the open tab's region (the tabs themselves sit in the header, on its separator) and the docked live panel. */
export const SepayConsole = (props: SepayConsoleProps) => {
    const { selected } = useSepayTab(props.connectionId, props.tab)
    return <SepayConsoleBase shape={props.shape} props={{ selected }} />
}
