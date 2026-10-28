import { Badge, Button, PageHeader } from "@starci/grammar/common"
import type { BadgeTone } from "@starci/grammar/common"
import { ProviderLogo } from "@/components/branches/ProviderLogo"
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
        readonly markSrc: string
        readonly tabs: {
            readonly label: string
            readonly items: ReadonlyArray<{ readonly id: string; readonly label: string }>
            readonly selected: string
        }
        readonly disconnectLabel: string
        readonly isPending: boolean
        readonly isOwner: boolean
    }
    readonly on: {
        readonly retry: () => void
        readonly switchEnvironment: () => void
        readonly disconnect: () => void
        readonly selectTab: (id: string) => void
    }
}

/** Draws the page header of a SePay connection: trail, mark, name, status and environment, the provider facts, the two actions and the page tabs. */
export const SepayHeaderBase = (props: SepayHeaderBaseProps) => {
    const { slot } = props.props
    const view = slot.items ?? props.props.placeholder
    const isSkeleton = slot.items === undefined
    const canAct = !view.isDisconnected && props.props.isOwner
    return (
        <PageHeader
            title={view.name}
            isSkeleton={isSkeleton}
            breadcrumbs={{ label: props.props.crumbLabel, items: [...props.props.crumbs] }}
            mark={<ProviderLogo glyph="wallet" src={props.props.markSrc} />}
            status={
                <>
                    <Badge isDot tone={view.statusTone}>
                        {view.statusLabel}
                    </Badge>
                    <Badge tone={view.environmentTone}>{view.environmentLabel}</Badge>
                </>
            }
            meta={view.facts}
            description={
                <SlotView
                    slot={slot}
                    placeholder={props.props.placeholder}
                    labels={props.props.labels}
                    onRetry={props.on.retry}
                >
                    {() => null}
                </SlotView>
            }
            actions={
                canAct ? (
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
                ) : undefined
            }
            tabs={{
                label: props.props.tabs.label,
                items: [...props.props.tabs.items],
                selectedKey: props.props.tabs.selected,
                labelVisibility: "always",
                panelId: (id) => `sepay-panel-${id}`,
                onSelect: props.on.selectTab,
            }}
        />
    )
}
