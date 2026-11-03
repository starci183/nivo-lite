import { Alert, Badge, Button, Cluster, Page, Pane, PaneGrid, PaneSection, Text } from "@starci/grammar/common"
import {
    ConnectionPaneLayoutNotice,
    connectionGridOf,
    connectionRailPaneOf,
    connectionRefusedHeaderOf,
} from "@/components/composites/ConnectionPaneLayout"
import type { PageHeaderContent } from "@starci/grammar/common"
import type { ReactNode } from "react"
import { ProviderLogo } from "@/components/branches/ProviderLogo"
import { ConnectionDisconnectBand } from "@/components/branches/ConnectionDisconnectBand"
import { ConnectionDisconnectDialog } from "@/components/branches/ConnectionDisconnectDialog"
import { CONNECTION_LINES_PLACEHOLDER, ConnectionLines } from "@/components/composites/ConnectionLines"
import { SlotView } from "@nivo/agent-sdk/workbench"
import type {
    ConnectionHeadView,
    ConnectionRefusalView,
    ConnectionLineView,
    ConnectionPageHeadCommands,
    ConnectionPageHeadView,
    DataSlot,
    SlotLabels,
} from "@/modules/types"

/** Fake data of the same shape: the skeleton reuses the ready tree. */
const HEAD_PLACEHOLDER: ConnectionHeadView = { name: "-", chipLabel: "-", chipTone: "neutral", facts: "-" }

/** Copy, slot and commands of the frame of a provider connection page. */
export interface ConnectionPageHeadBaseProps {
    /** The bands of the main pane, connected by the page. */
    readonly children: ReactNode
    readonly props: ConnectionPageHeadView & {
        /** The provider's own mark. */
        readonly markSrc: string
        /** The notice drawn in place of the page for a member who may not read it. */
        readonly refusal?: ConnectionRefusalView
        /** The live rail: the heading with the live mark, the lines newest first, the footnote. */
        readonly events: {
            readonly title: string
            readonly liveLabel: string
            readonly footnote: string
            readonly lines: DataSlot<ReadonlyArray<ConnectionLineView>>
            readonly slotLabels: SlotLabels
        }
    }
    readonly on: ConnectionPageHeadCommands & { readonly retryEvents: () => void }
}

type HeadBandProps = Pick<ConnectionPageHeadBaseProps, "props" | "on">

const NoticesBand = (props: HeadBandProps) =>
    props.props.notices.length === 0 ? null : (
        <PaneSection>
            {props.props.notices.map((notice) => (
                <Alert
                    key={notice.id}
                    tone={notice.tone}
                    title={notice.title}
                    {...(notice.description === undefined ? {} : { description: notice.description })}
                    {...(notice.action === undefined
                        ? {}
                        : { action: { label: notice.action.label, onAction: notice.action.run } })}
                />
            ))}
        </PaneSection>
    )

/** The header band: the provider's own, or the trail home and the title for a member who may not read the page. */
const headerOf = (props: HeadBandProps): PageHeaderContent => {
    const p = props.props
    if (p.refusal !== undefined) return connectionRefusedHeaderOf(p.refusal)
    const head = p.head
    const view = head ?? HEAD_PLACEHOLDER
    const action = p.action
    return {
        breadcrumbs: { label: p.crumbLabel, items: p.crumbs },
        mark: <ProviderLogo glyph={p.icon} src={p.markSrc} />,
        title: view.name,
        status: (
            <Badge isDot tone={view.chipTone}>
                {view.chipLabel}
            </Badge>
        ),
        meta: view.facts,
        actions:
            head === undefined || action === undefined ? undefined : (
                <Button intent={action.intent} isPending={action.isPending} onPress={props.on.act}>
                    {action.label}
                </Button>
            ),
    }
}

/** Draws the live rail of a provider page as the bands of its pane: the heading with the live mark, the lines newest first, the footnote. */
const EventsRail = (props: HeadBandProps) => (
    <>
        <PaneSection>
            <SlotView
                slot={props.props.events.lines}
                placeholder={CONNECTION_LINES_PLACEHOLDER}
                labels={props.props.events.slotLabels}
                onRetry={props.on.retryEvents}
                render={(lines, isSkeleton) => (
                    <ConnectionLines label={props.props.events.title} isSkeleton={isSkeleton} lines={lines} />
                )}
            />
        </PaneSection>
        <PaneSection as="footer">
            <Cluster gap="inline">
                <Badge isDot tone="success">
                    {props.props.events.liveLabel}
                </Badge>
                <Text size="xs" tone="muted">
                    {props.props.events.footnote}
                </Text>
            </Cluster>
        </PaneSection>
    </>
)

/**
 * Draws a provider connection page as one page with no tabs (`Page chrome="panes"`): the header band (mark, name, status, facts, one
 * command), then a main pane of bands (notices, the page's own bands, disconnect) beside the live rail, which becomes a drawer on a
 * narrow screen. Disconnect asks first. A member who may not read the page gets the trail home and one notice in the main pane.
 */
export const ConnectionPageHeadBase = (props: ConnectionPageHeadBaseProps) => {
    const { rail, disconnect, refusal } = props.props
    const isRefused = refusal !== undefined
    const grid = connectionGridOf(isRefused)
    const isWaiting = isRefused ? false : props.props.isLoading
    return (
        <Page chrome="panes" measure="product" isLoading={isWaiting} header={headerOf(props)}>
            <PaneGrid label={props.props.gridLabel} areas={grid.areas} columns={grid.columns}>
                <Pane area="main" surface scroll label={props.props.mainLabel}>
                    <ConnectionPaneLayoutNotice refusal={refusal} />
                    <NoticesBand props={props.props} on={props.on} />
                    {props.children}
                    {disconnect === undefined ? null : (
                        <ConnectionDisconnectBand {...disconnect} onPress={props.on.askDisconnect} />
                    )}
                    <ConnectionDisconnectDialog
                        confirm={props.props.confirm}
                        onConfirm={props.on.confirmDisconnect}
                        onDismiss={props.on.dismiss}
                    />
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
