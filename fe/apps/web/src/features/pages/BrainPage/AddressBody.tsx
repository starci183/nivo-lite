"use client"

import type { ReactElement } from "react"
import { useBrainAddressTab } from "@/hooks/brain"
import { useWorkspaceId } from "@/hooks/workspaces"
import { CONSOLE_ROUTES, brainStripTabOf, workspaceHref, type BrainStripTab } from "@/modules/routes"
import type { BrainPageHeading } from "@/modules/types"
import { BrainPageBase } from "./component"

/** What the loading boundary supplies: the heading of each tab of the strip, translated on the server. */
interface BrainAddressBodyProps {
    readonly headings: Readonly<Record<BrainStripTab, BrainPageHeading>>
}

/**
 * The Second Brain for a boundary that knows no address: the tab comes from the browser's address, so the heading and the blocks drawn
 * are the ones the page lands on; the trail's home link takes the workspace from the address too.
 */
export const BrainAddressBody = (props: BrainAddressBodyProps): ReactElement => {
    const tab = useBrainAddressTab()
    const workspaceId = useWorkspaceId()
    const heading = props.headings[brainStripTabOf(tab)]
    const home = workspaceHref(workspaceId, CONSOLE_ROUTES.workspaceHome)
    return (
        <BrainPageBase
            props={{
                header: {
                    ...heading,
                    breadcrumbs: {
                        ...heading.breadcrumbs,
                        items: heading.breadcrumbs.items.map((item) => (item.id === "home" ? { ...item, href: home } : item)),
                    },
                },
                tab,
                fact: undefined,
                edit: undefined,
                answer: undefined,
                lesson: undefined,
                compose: undefined,
                composeTitle: "",
                publicDoc: undefined,
                policy: undefined,
            }}
        />
    )
}
