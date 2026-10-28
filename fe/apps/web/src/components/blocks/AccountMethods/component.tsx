import { Badge, DescriptionList, SurfaceCard } from "@starci/grammar/common"
import { SlotView } from "@/components/composites/SlotView"
import type { DataSlot, MethodView, SlotLabels } from "@/modules/types"

/** Copy and values the connected sign-in methods card supplies. */
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

/** Draws the sign-in methods card without reading copy, navigation or API state. */
export const AccountMethodsBase = (props: AccountMethodsBaseProps) => (
    <SlotView
        slot={props.props.slot}
        placeholder={props.props.placeholder}
        labels={props.props.labels}
        onRetry={props.on.retry}
    >
        {(methods, isSkeleton) => (
            <SurfaceCard label={props.props.title} headingLevel={2}>
                <DescriptionList
                    layout="columns"
                    isLoading={isSkeleton}
                    isDivided
                    items={methods.map((method) => ({
                        id: method.id,
                        term: method.label,
                        description: (
                            <Badge tone={method.isLinked ? "success" : "neutral"} isSkeleton={isSkeleton}>
                                {method.isLinked ? props.props.linkedLabel : props.props.notLinkedLabel}
                            </Badge>
                        ),
                    }))}
                />
            </SurfaceCard>
        )}
    </SlotView>
)
