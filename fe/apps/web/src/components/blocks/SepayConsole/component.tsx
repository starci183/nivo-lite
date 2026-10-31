import { Alert, Badge, Button, Page, Pane, PaneGrid, PaneSection, SectionHeader } from "@starci/grammar/common"
import type { BadgeTone, PageHeaderContent } from "@starci/grammar/common"
import type { ReactNode } from "react"
import { ProviderLogo } from "@/components/branches/ProviderLogo"
import { SepayConfirm } from "@/components/composites/SepayConfirm"
import { SlotView } from "@/components/composites/SlotView"
import type { DataSlot, SlotLabels } from "@/modules/types"

/** The bands the page places: the main pane's (health, setup steps) and the live rail's. */
export interface SepayConsoleShape {
    readonly main: ReactNode
    readonly rail: ReactNode
}

/** What the header shows once the connection is read. */
export interface SepayHeaderView {
    readonly name: string
    readonly statusLabel: string
    readonly statusTone: BadgeTone
    readonly environmentLabel: string
    readonly environmentTone: BadgeTone
    readonly facts: string
    /** Why the last delivery failed, worded by the back end; empty when nothing failed. */
    readonly lastError: string
}

/** The confirmation of a disconnect. */
export interface SepayDisconnectConfirm {
    readonly isOpen: boolean
    readonly title: string
    readonly description: string
    readonly confirmLabel: string
    readonly cancelLabel: string
}

/** Props for {@link SepayConsoleBase}. */
export interface SepayConsoleBaseProps {
    readonly shape: SepayConsoleShape
    readonly props: {
        readonly slot: DataSlot<SepayHeaderView>
        readonly placeholder: SepayHeaderView
        readonly labels: SlotLabels
        readonly crumbLabel: string
        readonly crumbs: ReadonlyArray<{ readonly id: string; readonly label: string; readonly href?: string }>
        readonly markSrc: string
        readonly gridLabel: string
        readonly mainLabel: string
        readonly rail: {
            readonly label: string
            readonly openLabel: string
            readonly closeLabel: string
            readonly isOpen: boolean
        }
        readonly errorTitle: string
        /** Disconnect belongs to the workspace owner; absent for everyone else, whom the back end refuses. */
        readonly disconnect?: { readonly title: string; readonly description: string; readonly label: string }
        /** A disconnected connection is read-only: the way to connect it again, absent while it is connected. */
        readonly reconnect?: {
            readonly title: string
            readonly description: string
            readonly label: string
            readonly href: string
        }
        readonly isPending: boolean
        readonly confirm: SepayDisconnectConfirm
    }
    readonly on: {
        readonly retry: () => void
        /** Opens the confirmation; nothing is disconnected until `confirmDisconnect`. */
        readonly askDisconnect: () => void
        readonly confirmDisconnect: () => void
        readonly dismiss: () => void
        readonly openRail: (isOpen: boolean) => void
    }
}

/** What a band of the main pane reads: the copy and the commands, never the bands the page places. */
type SepayBandProps = Pick<SepayConsoleBaseProps, "props" | "on">

/** The header content of a SePay connection: trail, mark, name, status and environment, and the provider facts. */
const headerOf = (props: SepayConsoleBaseProps["props"]): PageHeaderContent => {
    const view = props.slot.items ?? props.placeholder
    return {
        title: view.name,
        breadcrumbs: { label: props.crumbLabel, items: [...props.crumbs] },
        mark: <ProviderLogo glyph="wallet" src={props.markSrc} />,
        status: (
            <>
                <Badge isDot tone={view.statusTone}>
                    {view.statusLabel}
                </Badge>
                <Badge tone={view.environmentTone}>{view.environmentLabel}</Badge>
            </>
        ),
        meta: view.facts,
    }
}

const isFailed = (slot: DataSlot<SepayHeaderView>): boolean => slot.isError === true || slot.isForbidden === true

/** The first band of the main pane: the read failed in place, or the last delivery failed; absent when neither. */
const NoticeBand = (props: SepayBandProps) => {
    const { slot } = props.props
    const lastError = slot.items?.lastError ?? ""
    if (!isFailed(slot) && lastError === "") return null
    return (
        <PaneSection>
            {isFailed(slot) ? (
                <SlotView
                    slot={slot}
                    placeholder={props.props.placeholder}
                    labels={props.props.labels}
                    forbidden="notice"
                    onRetry={props.on.retry}
                >
                    {() => null}
                </SlotView>
            ) : (
                <Alert tone="negative" title={props.props.errorTitle} description={lastError} />
            )}
        </PaneSection>
    )
}

/** The band of a disconnected connection: the page is read-only and this leads to connecting it again. */
const ReconnectBand = (props: SepayBandProps) => {
    const { reconnect } = props.props
    if (reconnect === undefined) return null
    return (
        <PaneSection>
            <SectionHeader
                level={2}
                title={reconnect.title}
                description={reconnect.description}
                action={
                    <Button intent="alternative" href={reconnect.href}>
                        {reconnect.label}
                    </Button>
                }
            />
        </PaneSection>
    )
}

const DisconnectBand = (props: SepayBandProps) => {
    const { disconnect } = props.props
    if (disconnect === undefined) return null
    return (
        <PaneSection>
            <SectionHeader
                level={2}
                title={disconnect.title}
                description={disconnect.description}
                action={
                    <Button
                        intent="destructive"
                        step="entry"
                        isDisabled={props.props.isPending}
                        onPress={props.on.askDisconnect}
                    >
                        {disconnect.label}
                    </Button>
                }
            />
        </PaneSection>
    )
}

/**
 * Draws the page of a SePay connection as one page with no tabs (`Page chrome="panes"`): the header band (status and environment),
 * then a main pane of bands (notice, health, the numbered setup steps, disconnect) beside the live webhook rail, which becomes a
 * drawer on a narrow screen. Disconnect asks first.
 */
export const SepayConsoleBase = (props: SepayConsoleBaseProps) => {
    const { rail } = props.props
    return (
        <>
            <Page
                chrome="panes"
                header={headerOf(props.props)}
                isSkeleton={props.props.slot.isLoading === true}
                measure="product"
            >
                <PaneGrid
                    label={props.props.gridLabel}
                    areas={{ base: ["main"], medium: ["main rail"] }}
                    columns={{ base: ["fill"], medium: ["fill", "standard"] }}
                >
                    <Pane area="main" surface scroll label={props.props.mainLabel}>
                        <ReconnectBand props={props.props} on={props.on} />
                        <NoticeBand props={props.props} on={props.on} />
                        {isFailed(props.props.slot) ? null : props.shape.main}
                        <DisconnectBand props={props.props} on={props.on} />
                    </Pane>
                    <Pane
                        area="rail"
                        surface
                        scroll
                        label={rail.label}
                        collapse="drawer"
                        collapseLabel={rail.label}
                        openLabel={rail.openLabel}
                        closeLabel={rail.closeLabel}
                        isOpen={rail.isOpen}
                        onOpenChange={props.on.openRail}
                    >
                        {props.shape.rail}
                    </Pane>
                </PaneGrid>
            </Page>
            <SepayConfirm
                {...props.props.confirm}
                isPending={props.props.isPending}
                onConfirm={props.on.confirmDisconnect}
                onDismiss={props.on.dismiss}
            />
        </>
    )
}
