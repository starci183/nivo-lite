import {
    Alert,
    Badge,
    Button,
    EmptyNotice,
    Page,
    Pane,
    PaneGrid,
    PaneSection,
    Section,
    Text,
    type BadgeTone,
    type PageHeaderContent,
} from "@starci/grammar/common"

import {
    ConnectionPaneLayoutNotice,
    connectionGridOf,
    connectionRefusedHeaderOf,
} from "@/components/composites/ConnectionPaneLayout"
import type { ReactNode } from "react"
import { ProviderLogo } from "@/components/branches/ProviderLogo"
import { SepayConfirm } from "@/components/composites/SepayConfirm"
import { SlotView } from "@nivo/agent-sdk/workbench"
import type { ConnectionRefusalView, DataSlot, SlotLabels } from "@/modules/types"

/** One delivery of the live rail as it is worded. */
interface SepayEventRow {
    readonly id: string
    readonly title: string
    readonly statusLabel: string
    readonly statusTone: BadgeTone
    readonly detail: string
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
    /** The bands of the main pane (health, setup steps), connected by the page. */
    readonly children: ReactNode
    readonly props: {
        readonly slot: DataSlot<SepayHeaderView>
        readonly placeholder: SepayHeaderView
        readonly labels: SlotLabels
        readonly crumbLabel: string
        readonly crumbs: ReadonlyArray<{ readonly id: string; readonly label: string; readonly href?: string }>
        readonly markSrc: string
        /** The notice drawn in place of the page for a member who may not read it. */
        readonly refusal?: ConnectionRefusalView
        readonly gridLabel: string
        readonly mainLabel: string
        readonly rail: {
            readonly label: string
            readonly openLabel: string
            readonly closeLabel: string
            readonly isOpen: boolean
        }
        readonly errorTitle: string
        /** The live rail of webhook deliveries. */
        readonly events: {
            readonly title: string
            readonly liveLabel: string
            /** How the rail keeps itself current, under the list. */
            readonly footnote: string
            readonly slot: DataSlot<ReadonlyArray<SepayEventRow>>
            readonly placeholder: ReadonlyArray<SepayEventRow>
            readonly labels: SlotLabels
        }
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
        readonly retryEvents: () => void
    }
}

/** What a band of the main pane reads: the copy and the commands, never the bands the page places. */
type SepayBandProps = Pick<SepayConsoleBaseProps, "props" | "on">

/** The header content of a SePay connection: trail, mark, name, status and environment, and the provider facts. */
const headerOf = (props: SepayConsoleBaseProps["props"]): PageHeaderContent => {
    const view = "items" in props.slot ? props.slot.items : props.placeholder
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

const isFailed = (slot: DataSlot<SepayHeaderView>): boolean => "isError" in slot || "isForbidden" in slot

/** The first band of the main pane: the read failed in place, or the last delivery failed; absent when neither. */
const NoticeBand = (props: SepayBandProps) => {
    const { slot } = props.props
    const lastError = "items" in slot ? slot.items.lastError : ""
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
                    render={() => null}
                />
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
            <Section
                headingLevel={2}
                title={reconnect.title}
                action={
                    <Button intent="alternative" href={reconnect.href}>
                        {reconnect.label}
                    </Button>
                }
            >
                <Text tone="muted">{reconnect.description}</Text>
            </Section>
        </PaneSection>
    )
}

const DisconnectBand = (props: SepayBandProps) => {
    const { disconnect } = props.props
    if (disconnect === undefined) return null
    return (
        <PaneSection>
            <Section
                headingLevel={2}
                title={disconnect.title}
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
            >
                <Text tone="muted">{disconnect.description}</Text>
            </Section>
        </PaneSection>
    )
}

/** The live rail: the deliveries newest first with the live cue, and the source note in its footer band. */
const EventsRail = (props: SepayBandProps) => {
    const { events } = props.props
    return (
        <>
            <PaneSection>
                <SlotView
                    slot={events.slot}
                    placeholder={events.placeholder}
                    labels={events.labels}
                    onRetry={props.on.retryEvents}
                    render={(rows, isSkeleton) => (
                        <Section
                            kind="list"
                            title={events.title}
                            isLoading={isSkeleton}
                            action={
                                <Badge isDot tone="success">
                                    {events.liveLabel}
                                </Badge>
                            }
                            items={rows.map((event) => ({
                                id: event.id,
                                title: event.title,
                                description: event.detail,
                                badges: [{ label: event.statusLabel, tone: event.statusTone }] as const,
                            }))}
                            empty={<EmptyNotice message={events.labels.empty} />}
                        />
                    )}
                />
            </PaneSection>
            <PaneSection as="footer">
                <Text size="xs" tone="muted">
                    {events.footnote}
                </Text>
            </PaneSection>
        </>
    )
}

/**
 * Draws the page of a SePay connection as one page with no tabs (`Page chrome="panes"`): the header band (status and environment),
 * then a main pane of bands (notice, health, the numbered setup steps, disconnect) beside the live webhook rail, which becomes a
 * drawer on a narrow screen. Disconnect asks first. A member who may not read the page gets the trail home and one notice.
 */
export const SepayConsoleBase = (props: SepayConsoleBaseProps) => {
    const { rail, refusal } = props.props
    const isRefused = refusal !== undefined
    const { areas, columns } = connectionGridOf(isRefused)
    const isWaiting = isRefused ? false : "isLoading" in props.props.slot
    return (
        <Page
            chrome="panes"
            header={isRefused ? connectionRefusedHeaderOf(refusal) : headerOf(props.props)}
            isLoading={isWaiting}
            measure="product"
        >
            <PaneGrid label={props.props.gridLabel} areas={areas} columns={columns}>
                <Pane area="main" surface scroll label={props.props.mainLabel}>
                    <ConnectionPaneLayoutNotice refusal={refusal} />
                    <ReconnectBand props={props.props} on={props.on} />
                    <NoticeBand props={props.props} on={props.on} />
                    {props.children}
                    <DisconnectBand props={props.props} on={props.on} />
                    <SepayConfirm
                        {...props.props.confirm}
                        isPending={props.props.isPending}
                        onConfirm={props.on.confirmDisconnect}
                        onDismiss={props.on.dismiss}
                    />
                </Pane>
                {!isRefused && (
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
                        <EventsRail props={props.props} on={props.on} />
                    </Pane>
                )}
            </PaneGrid>
        </Page>
    )
}
