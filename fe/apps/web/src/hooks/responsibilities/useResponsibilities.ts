"use client"

import { useTranslations } from "next-intl"
import { useQueryAgentsSwr, useQueryResponsibilitiesSwr } from "@/hooks/swr"
import { slotOfReads } from "@/hooks/slot"
import type { DataSlot } from "@/modules/types"
import { toRowModelsFromWire } from "@/modules/responsibilities"
import type { ResponsibilityRowView } from "@/modules/responsibilities"

/** Every responsibility of the active workspace as display rows, read from the back end through SWR (with a reload). */
export const useResponsibilities = (): {
    readonly slot: DataSlot<ReadonlyArray<ResponsibilityRowView>>
    readonly reload: () => void
} => {
    const t = useTranslations("responsibilities")
    const read = useQueryResponsibilitiesSwr()
    const agents = useQueryAgentsSwr({})
    const reload = () => {
        void read.mutate()
        void agents.mutate()
    }
    return {
        slot: slotOfReads([read, agents], () => {
            if (read.data === undefined || agents.data === undefined)
                throw new Error("Ready responsibilities require both settled reads")
            return toRowModelsFromWire(read.data, agents.data, new Date(), t)
        }),
        reload,
    }
}
