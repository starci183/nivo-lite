import { Badge, Button, Page } from "@starci/grammar/common"
import type { BadgeTone, PageHeaderContent } from "@starci/grammar/common"
import type { ReactNode } from "react"
import { ProviderLogo } from "@/components/branches/ProviderLogo"
import { SlotView } from "@/components/composites/SlotView"
import type { DataSlot, SlotLabels } from "@/modules/types"
import { sepayConsoleClassNames as classNames } from "./classNames"

/** The connected regions the page places. */
export interface SepayConsoleShape {
    readonly overview: ReactNode
    readonly setup: ReactNode
    readonly test: ReactNode
    readonly agents: ReactNode
    readonly events: ReactNode
}

/** The tabs of the page, in order. */
export type SepayTabId = "overview" | "setup" | "test" | "agents"

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

/** The words, data and commands of the header band. */
export interface SepayHeaderInput {
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

/** Props for {@link SepayConsoleBase}. */
export interface SepayConsoleBaseProps {
    readonly shape: SepayConsoleShape
    readonly props: SepayHeaderInput["props"] & { readonly selected: SepayTabId }
    readonly on: SepayHeaderInput["on"]
}

/** The header content of a SePay connection: trail, mark, name, status and environment, the provider facts, the two actions and the page tabs. */
const sepayHeaderOf = (input: SepayHeaderInput, selected: SepayTabId): PageHeaderContent => {
    const { slot } = input.props
    const view = slot.items ?? input.props.placeholder
    const isSkeleton = slot.items === undefined
    const canAct = !view.isDisconnected && input.props.isOwner
    return {
        title: view.name,
        breadcrumbs: { label: input.props.crumbLabel, items: [...input.props.crumbs] },
        mark: <ProviderLogo glyph="wallet" src={input.props.markSrc} />,
        status: (
            <>
                <Badge isDot tone={view.statusTone}>
                    {view.statusLabel}
                </Badge>
                <Badge tone={view.environmentTone}>{view.environmentLabel}</Badge>
            </>
        ),
        meta: view.facts,
        description: (
            <SlotView
                slot={slot}
                placeholder={input.props.placeholder}
                labels={input.props.labels}
                onRetry={input.on.retry}
            >
                {() => null}
            </SlotView>
        ),
        actions: canAct ? (
            <>
                <Button
                    intent="neutral"
                    isDisabled={isSkeleton || input.props.isPending}
                    onPress={input.on.switchEnvironment}
                >
                    {view.switchLabel}
                </Button>
                <Button
                    intent="destructive"
                    isDisabled={isSkeleton || input.props.isPending}
                    onPress={input.on.disconnect}
                >
                    {input.props.disconnectLabel}
                </Button>
            </>
        ) : undefined,
        tabs: {
            label: input.props.tabs.label,
            items: [...input.props.tabs.items],
            selectedKey: selected,
            labelVisibility: "always",
            panelId: (id) => `sepay-panel-${id}`,
            onSelect: input.on.selectTab,
        },
    }
}

/** Draws the page of a connection: one `Page` whose header is the connection band, and whose body is the open tab region with the live event panel docked beside it. */
export const SepayConsoleBase = (props: SepayConsoleBaseProps) => (
    <Page
        header={sepayHeaderOf({ props: props.props, on: props.on }, props.props.selected)}
        isSkeleton={props.props.slot.items === undefined}
        measure="product"
    >
        <div className={classNames.frame}>
            <div className={classNames.main} role="tabpanel" id={`sepay-panel-${props.props.selected}`}>
                {props.shape[props.props.selected]}
            </div>
            <aside className={classNames.aside}>{props.shape.events}</aside>
        </div>
    </Page>
)
