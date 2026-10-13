import { LeadGenRowList } from "@/components/composites/LeadGenRowList"
import type { LeadGenRowListProps } from "@/components/composites/LeadGenRowList"
import { PanelPending } from "@/components/composites/PanelPending"
import type { PanelPendingProps } from "@/components/composites/PanelPending"

/** Props for {@link LeadGenListBase}: the list once read, or the pending state of the panel. */
export interface LeadGenListBaseProps {
    readonly props: { readonly list: LeadGenRowListProps | null; readonly pending: PanelPendingProps }
}

/** Draws one Lead Gen list (prospects, sources or Sales handoffs), or its skeleton or failure while it is not read. */
export const LeadGenListBase = (props: LeadGenListBaseProps) =>
    props.props.list === null ? <PanelPending {...props.props.pending} /> : <LeadGenRowList {...props.props.list} />
