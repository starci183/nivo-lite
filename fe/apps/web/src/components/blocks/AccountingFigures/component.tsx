import { DescriptionList, SurfaceCard } from "@starci/grammar/common"
import type { DescriptionListStatItem } from "@starci/grammar/common"
import { SlotView } from "@/components/composites/SlotView"
import type { DataSlot, SlotLabels } from "@/modules/types"

/** Props for {@link AccountingFiguresBase}. */
export interface AccountingFiguresBaseProps {
    readonly props: {
        /** The aria name of the ribbon. */
        readonly label: string
        /** The four figures once the read model is read; its status is the slot's. */
        readonly slot: DataSlot<ReadonlyArray<DescriptionListStatItem>>
        readonly labels: SlotLabels
        /** The four figures over fake data of the same shape: drawn with isSkeleton while the read is in flight. */
        readonly placeholder: ReadonlyArray<DescriptionListStatItem>
    }
    readonly on: { readonly retry: () => void }
}

/** Draws the ribbon of the Accounting workbench: income, receivables, unmatched payments and ageing. */
export const AccountingFiguresBase = (props: AccountingFiguresBaseProps) => (
    <SlotView {...props.props} onRetry={props.on.retry}>
        {(items, isSkeleton) => (
            <SurfaceCard ariaLabel={props.props.label}>
                <DescriptionList layout="stat-strip" isDivided isLoading={isSkeleton} items={items} />
            </SurfaceCard>
        )}
    </SlotView>
)
