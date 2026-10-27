import { LeadGenRowList } from "@/components/composites/LeadGenRowList"
import type { LeadGenRowListProps } from "@/components/composites/LeadGenRowList"
import { SlotView } from "@/components/composites/SlotView"
import type { SlotPanelProps } from "@/modules/types"

/** Props for {@link LeadGenListBase}: the list slot, its same-shape placeholder and the words of its status. */
export interface LeadGenListBaseProps {
    /** The placeholder is the list with no rows: its words stay real while the rows draw as skeleton. */
    readonly props: SlotPanelProps<LeadGenRowListProps>
    readonly on: { readonly retry: () => void }
}

/** Draws one Lead Gen list (prospects, sources or Sales handoffs); its status goes through SlotView. */
export const LeadGenListBase = (props: LeadGenListBaseProps) => {
    const { props: p, on } = props
    return (
        <SlotView slot={p.slot} placeholder={p.placeholder} labels={p.labels} onRetry={on.retry}>
            {(list, isSkeleton) => <LeadGenRowList {...list} isSkeleton={isSkeleton} />}
        </SlotView>
    )
}
