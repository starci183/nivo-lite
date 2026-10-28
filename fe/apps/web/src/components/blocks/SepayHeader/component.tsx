import { Badge, Breadcrumbs, Button, SectionHeader, Text } from "@starci/grammar/common"
import type { BadgeTone } from "@starci/grammar/common"
import { SlotView } from "@/components/composites/SlotView"
import type { DataSlot, SlotLabels } from "@/modules/types"

/** What the header shows once the connection is read. */
export interface SepayHeaderView {
    readonly name: string
    readonly statusLabel: string
    readonly statusTone: BadgeTone
    readonly environmentLabel: string
    readonly environmentTone: BadgeTone
    readonly facts: string
    readonly switchLabel: string
    readonly isDisconnected: boolean
}

/** Props for {@link SepayHeaderBase}. */
export interface SepayHeaderBaseProps {
    readonly props: {
        readonly slot: DataSlot<SepayHeaderView>
        readonly placeholder: SepayHeaderView
        readonly labels: SlotLabels
        readonly crumbLabel: string
        readonly crumbs: ReadonlyArray<{ readonly id: string; readonly label: string; readonly href?: string }>
        readonly disconnectLabel: string
        readonly isPending: boolean
        readonly isOwner: boolean
    }
    readonly on: {
        readonly retry: () => void
        readonly switchEnvironment: () => void
        readonly disconnect: () => void
    }
}

/** Draws the heading of a SePay connection: trail, name, status and environment, the provider facts and the two actions. */
export const SepayHeaderBase = (props: SepayHeaderBaseProps) => (
    <div>
        <Breadcrumbs label={props.props.crumbLabel} items={[...props.props.crumbs]} />
        <SlotView
            slot={props.props.slot}
            placeholder={props.props.placeholder}
            labels={props.props.labels}
            onRetry={props.on.retry}
        >
            {(view, isSkeleton) => (
                <SectionHeader
                    level={1}
                    title={view.name}
                    isSkeleton={isSkeleton}
                    meta={
                        <>
                            <Badge isDot tone={view.statusTone}>
                                {view.statusLabel}
                            </Badge>
                            <Badge tone={view.environmentTone}>{view.environmentLabel}</Badge>
                            <Text size="sm" tone="muted">
                                {view.facts}
                            </Text>
                        </>
                    }
                    action={
                        view.isDisconnected || !props.props.isOwner ? undefined : (
                            <>
                                <Button
                                    intent="neutral"
                                    isDisabled={isSkeleton || props.props.isPending}
                                    onPress={props.on.switchEnvironment}
                                >
                                    {view.switchLabel}
                                </Button>
                                <Button
                                    intent="destructive"
                                    isDisabled={isSkeleton || props.props.isPending}
                                    onPress={props.on.disconnect}
                                >
                                    {props.props.disconnectLabel}
                                </Button>
                            </>
                        )
                    }
                />
            )}
        </SlotView>
    </div>
)
