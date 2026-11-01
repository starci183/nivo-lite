import { Badge, ListRow, SurfaceListCard } from "@starci/grammar/common"
import { SlotView } from "@/components/composites/SlotView"
import type { DataSlot, MethodView, SlotLabels } from "@/modules/types"

/** Copy and values the connected sign-in methods list supplies. */
export interface AccountMethodsBaseProps {
    readonly props: {
        readonly title: string
        readonly linkedLabel: string
        readonly notLinkedLabel: string
        readonly slot: DataSlot<ReadonlyArray<MethodView>>
        /** The methods drawn as a skeleton while the account loads. */
        readonly placeholder: ReadonlyArray<MethodView>
        readonly labels: SlotLabels
    }
    readonly on: {
        readonly retry: () => void
    }
}

/** Draws the sign-in methods, a fixed set, as one list with the status of each, without reading copy, navigation or API state. */
export const AccountMethodsBase = (props: AccountMethodsBaseProps) => (
    <SlotView
        slot={props.props.slot}
        placeholder={props.props.placeholder}
        labels={props.props.labels}
        onRetry={props.on.retry}
    >
        {(methods, isSkeleton) => (
            <SurfaceListCard label={props.props.title} headingLevel={2}>
                {methods.map((method) => (
                    <ListRow
                        key={method.id}
                        isSkeleton={isSkeleton}
                        title={method.label}
                        badges={
                            <Badge tone={method.isLinked ? "success" : "neutral"} isSkeleton={isSkeleton}>
                                {method.isLinked ? props.props.linkedLabel : props.props.notLinkedLabel}
                            </Badge>
                        }
                    />
                ))}
            </SurfaceListCard>
        )}
    </SlotView>
)
