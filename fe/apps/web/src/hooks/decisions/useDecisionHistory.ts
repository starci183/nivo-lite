import { useQueryDecisionHistorySwr } from "@/hooks/swr"
import { slotOfSwr } from "@/hooks/slot"
import type { DataSlot, DecisionKind, DecisionRecord } from "@/modules/types"
import { DECISIONS_LIMIT, toDecisionRecord } from "./decisions.shared"

/** The decision history of the active workspace for one pair of filters, read from the back end through SWR (with a reload). */
export const useDecisionHistory = (
    kind: DecisionKind | null,
    department: string | null,
): { readonly slot: DataSlot<ReadonlyArray<DecisionRecord>>; readonly reload: () => void } => {
    const read = useQueryDecisionHistorySwr({ kind: kind ?? "all", department, limit: DECISIONS_LIMIT })
    const records: ReadonlyArray<DecisionRecord> | undefined = read.data?.map(toDecisionRecord)
    const reload = () => void read.mutate()
    return { slot: slotOfSwr({ data: records, error: read.error, isLoading: read.isLoading }), reload }
}
