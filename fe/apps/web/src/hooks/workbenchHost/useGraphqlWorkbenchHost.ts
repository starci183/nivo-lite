"use client"

import { useMemo } from "react"
import type { WorkbenchHost } from "@nivo-lite/agent-sdk/client"
import { useSlotLabels } from "@/hooks/slot"
import { useWorkbenchBlockHost } from "./useWorkbenchBlockHost"
import { useWorkbenchCan } from "./useWorkbenchCan"
import { useWorkbenchGraphqlAction } from "./useWorkbenchGraphqlAction"
import { useWorkbenchGraphqlRead } from "./useWorkbenchGraphqlRead"

/** The live host: the block ports over the app, the data ports over the generic read and action operations of the back end. */
export const useGraphqlWorkbenchHost = (): WorkbenchHost => {
    const block = useWorkbenchBlockHost()
    return useMemo<WorkbenchHost>(
        () => ({
            block,
            useRead: useWorkbenchGraphqlRead,
            useAction: useWorkbenchGraphqlAction,
            useCan: useWorkbenchCan,
            useSlotLabels,
        }),
        [block],
    )
}
