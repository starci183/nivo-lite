import { useTranslations } from "next-intl"
import { useQueryAgentsSwr } from "@/hooks/swr/api/graphql/queries/useQueryAgentsSwr"
import { useQueryResponsibilitiesSwr } from "@/hooks/swr/api/graphql/queries/useQueryResponsibilitiesSwr"
import { slotOfSwr } from "@/hooks/slot"
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
    const rows = read.data === undefined ? undefined : toRowModelsFromWire(read.data, agents.data ?? [], new Date(), t)
    const reload = () => void read.mutate()
    return { slot: slotOfSwr({ data: rows, error: read.error, isLoading: read.isLoading }), reload }
}
