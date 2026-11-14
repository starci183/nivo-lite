"use client"

import { useMemo } from "react"
import type { BlockHost } from "@nivo-lite/agent-sdk/block"
import type { WorkbenchHost } from "@nivo-lite/agent-sdk/client"
import { useSlotLabels } from "@/hooks/slot"
import { useWorkbenchBlockHost } from "@/hooks/workbenchHost"
import { useWorkbenchFixtureAction } from "./useWorkbenchFixtureAction"
import { useWorkbenchFixtureRead } from "./useWorkbenchFixtureRead"

/** Every permission is held in a prototype: the screen shows what the blocks draw, not what a viewer may see. */
const useAllowed = (): boolean => true

/** The block ports of a prototype: the app's, without the file store (no fixture holds files, and a prototype must not reach the real ones). */
const withoutFiles = (block: BlockHost): BlockHost => ({
    text: block.text,
    locale: block.locale,
    navigation: block.navigation,
    notify: block.notify,
    report: block.report,
})

/** The prototype host: the block ports over the app, the data ports over the fixtures. Dev and preview builds only. */
export const useFixtureWorkbenchHost = (): WorkbenchHost => {
    const block = useWorkbenchBlockHost()
    return useMemo<WorkbenchHost>(
        () => ({
            block: withoutFiles(block),
            useRead: useWorkbenchFixtureRead,
            useAction: useWorkbenchFixtureAction,
            useCan: useAllowed,
            useSlotLabels,
        }),
        [block],
    )
}
