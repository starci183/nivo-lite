import {
    Alert,
    Badge,
    Button,
    Cluster,
    Heading,
    Page,
    Pane,
    PaneGrid,
    PaneSection,
    Text,
    type BreadcrumbItem,
    type PageHeaderContent,
    type PresentationState,
} from "@starci/grammar/common"

import {
    ConnectionPaneLayoutNotice,
    connectionGridOf,
    connectionRailPaneOf,
    connectionRefusedHeaderOf,
} from "@/components/composites/ConnectionPaneLayout"
import type { ReactNode } from "react"
import { ProviderLogo } from "@/components/branches/ProviderLogo"
import { ConnectionDisconnect } from "@/components/composites/ConnectionDisconnect"
import { ConnectionLines } from "@/components/composites/ConnectionLines"
import { SlotView } from "@nivo-lite/agent-sdk/client"
import type { ConnectionRefusalView, DataSlot, SlotLabels, ZaloEventLineView, ZaloHeadView } from "@/modules/types"

/** Fake data of the same shape: the skeleton reuses the ready tree. */
const ZALO_HEAD_PLACEHOLDER: ZaloHeadView = {
    name: "-",
    chipLabel: "-",
    chipTone: "neutral",
    facts: "-",
    banner: "",
}

/** Fake rows of the same shape: the skeleton reuses the ready tree. */
const ZALO_EVENTS_PLACEHOLDER: ReadonlyArray<ZaloEventLineView> = [
    { id: "one", title: "-", outcomeLabel: "-", outcomeTone: "neutral", detail: "-" },
    { id: "two", title: "-", outcomeLabel: "-", outcomeTone: "neutral", detail: "-" },
    { id: "three", title: "-", outcomeLabel: "-", outcomeTone: "neutral", detail: "-" },
]

/** One notice of the page: why the OA cannot send, a refused command, or the one step left. */
export interface ZaloPageNotice {
    readonly id: string
    readonly tone: PresentationState
    readonly title: string
    readonly description?: string
}

/** The confirmation of a disconnect. */
export interface ZaloDisconnectConfirm {
    readonly isOpen: boolean
    readonly title: string
    readonly description: string
    readonly confirmLabel: string
    readonly cancelLabel: string
    readonly isPending: boolean
}

/** Copy, slot and commands of the frame of a Zalo OA connection page. */
export interface ZaloConnectionHeadBaseProps {
    /** The bands of the main pane (health, setup steps, ZNS), connected by the page. */
    readonly children: ReactNode
    readonly props: {
        readonly head: DataSlot<ZaloHeadView>
        /** The provider's own mark. */
        readonly markSrc: string
        /** The notice drawn in place of the page for a member who may not read it. */
        readonly refusal?: ConnectionRefusalView
        readonly slotLabels: SlotLabels
        readonly crumbLabel: string
        readonly crumbs: ReadonlyArray<BreadcrumbItem>
        readonly gridLabel: string
        readonly mainLabel: string
        readonly rail: {
            readonly label: string
            readonly openLabel: string
            readonly closeLabel: string
            readonly isOpen: boolean
        }
        /** The live rail: the heading with the live mark, the events newest first, the footnote. */
        readonly events: {
            readonly title: string
            readonly liveLabel: string
            readonly footnote: string
            readonly lines: DataSlot<ReadonlyArray<ZaloEventLineView>>
            readonly slotLabels: SlotLabels
        }
        readonly recheckLabel: string
        readonly isRechecking: boolean
        /** The notices under the header, in reading order; empty when the page has nothing to say. */
        readonly notices: ReadonlyArray<ZaloPageNotice>
        /** Disconnect belongs to the workspace owner; absent for everyone else, whom the back end refuses. */
        readonly disconnect?: {
            readonly title: string
            readonly description: string
            readonly label: string
        }
        readonly confirm: ZaloDisconnectConfirm
    }
    readonly on: {
        readonly recheck: () => void
        readonly askDisconnect: () => void
        readonly confirmDisconnect: () => void
        readonly dismiss: () => void
        readonly openRail: (isOpen: boolean) => void
        readonly retry: () => void
        readonly retryEvents: () => void
    }
}

/** What a band of the main pane reads: the copy and the commands, never the bands the page places. */
type ZaloBandProps = Pick<ZaloConnectionHeadBaseProps, "props" | "on">

const NoticesBand = (props: ZaloBandProps) => {
    const { notices } = props.props
    if (notices.length === 0) return null
    return (
        <PaneSection>
            {notices.map((notice) => (
                <Alert
                    key={notice.id}
                    tone={notice.tone}
                    title={notice.title}
                    {...(notice.description === undefined ? {} : { description: notice.description })}
                />
            ))}
        </PaneSection>
    )
}

/** The header of the OA: trail, mark, name, status, facts and "Check again". */
const headerOf = (props: ZaloBandProps): PageHeaderContent => {
    const p = props.props
    const view = "items" in p.head ? p.head.items : ZALO_HEAD_PLACEHOLDER
    return {
        breadcrumbs: { label: p.crumbLabel, items: p.crumbs },
        mark: <ProviderLogo glyph="chat" src={p.markSrc} />,
        title: view.name,
        status: (
            <Badge isDot tone={view.chipTone}>
                {view.chipLabel}
            </Badge>
        ),
        meta: view.facts,
        actions: (
            <Button intent="neutral" isPending={p.isRechecking} onPress={props.on.recheck}>
                {p.recheckLabel}
            </Button>
        ),
    }
}

/** The first band of the main pane when the header read failed in place; nothing otherwise. */
const HeadFailure = (props: ZaloBandProps) => {
    const { head } = props.props
    if (!("isError" in head) && !("isForbidden" in head)) return null
    return (
        <PaneSection>
            <SlotView
                slot={head}
                placeholder={ZALO_HEAD_PLACEHOLDER}
                labels={props.props.slotLabels}
                forbidden="notice"
                onRetry={props.on.retry}
                render={() => null}
            />
        </PaneSection>
    )
}

/** Draws the live Zalo events rail as the bands of its pane: the heading with the live mark, the events newest first, the footnote. */
const EventsRail = (props: ZaloBandProps) => {
    const { events } = props.props
    return (
        <>
            <PaneSection as="header">
                <Cluster gap="inline" justify="between">
                    <Heading level={2}>{events.title}</Heading>
                    <Badge isDot tone="success">
                        {events.liveLabel}
                    </Badge>
                </Cluster>
            </PaneSection>
            <PaneSection>
                <SlotView
                    slot={events.lines}
                    placeholder={ZALO_EVENTS_PLACEHOLDER}
                    labels={events.slotLabels}
                    onRetry={props.on.retryEvents}
                    render={(lines, isSkeleton) => (
                        <ConnectionLines
                            label={events.title}
                            isSkeleton={isSkeleton}
                            lines={lines.map((event) => ({
                                id: event.id,
                                title: event.title,
                                description: event.detail,
                                badge: { label: event.outcomeLabel, tone: event.outcomeTone },
                            }))}
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
 * Draws the page of the OA as one page with no tabs (`Page chrome="panes"`): the header band (mark, name, status, facts, "Check
 * again"), then a main pane of bands (notices, health, the numbered setup steps, ZNS, disconnect) beside the live events rail, which
 * becomes a drawer on a narrow screen. Disconnect asks first. A member who may not read the page gets the trail home and one notice.
 */
export const ZaloConnectionHeadBase = (props: ZaloConnectionHeadBaseProps) => {
    const { rail, refusal } = props.props
    const isRefused = refusal !== undefined
    const grid = connectionGridOf(isRefused)
    const isWaiting = isRefused ? false : "isLoading" in props.props.head
    return (
        <Page
            chrome="panes"
            measure="product"
            isLoading={isWaiting}
            header={isRefused ? connectionRefusedHeaderOf(refusal) : headerOf(props)}
        >
            <PaneGrid label={props.props.gridLabel} areas={grid.areas} columns={grid.columns}>
                <Pane area="main" surface scroll label={props.props.mainLabel}>
                    <ConnectionPaneLayoutNotice refusal={refusal} />
                    <HeadFailure props={props.props} on={props.on} />
                    <NoticesBand props={props.props} on={props.on} />
                    {props.children}
                    <ConnectionDisconnect props={props.props} on={props.on} />
                </Pane>
                {isRefused ? null : (
                    <Pane area="rail" surface scroll {...connectionRailPaneOf(rail, props.on.openRail)}>
                        <EventsRail props={props.props} on={props.on} />
                    </Pane>
                )}
            </PaneGrid>
        </Page>
    )
}
