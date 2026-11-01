import { Alert, Badge, Button, Page, Pane, PaneGrid, PaneSection } from "@starci/grammar/common"
import type { ComponentProps, ReactNode } from "react"
import { ProviderLogo } from "@/components/branches/ProviderLogo"
import { ConnectionDisconnectBand } from "@/components/composites/ConnectionDisconnectBand"
import { ConnectionDisconnectDialog } from "@/components/composites/ConnectionDisconnectDialog"
import { ConnectionRefusedPage } from "@/components/composites/ConnectionRefusedPage"
import type { ConnectionHeadView, ConnectionPageHeadCommands, ConnectionPageHeadView } from "@/modules/types"

/** Fake data of the same shape: the skeleton reuses the ready tree. */
const HEAD_PLACEHOLDER: ConnectionHeadView = { name: "-", chipLabel: "-", chipTone: "neutral", facts: "-" }

/** Copy, slot and commands of the frame of a provider connection page. */
export interface ConnectionPageHeadBaseProps {
    /** The bands of the main pane and of the live rail, connected by the page. */
    readonly shape: { readonly main: ReactNode; readonly rail: ReactNode }
    readonly props: ConnectionPageHeadView & {
        /** The provider's own mark. */
        readonly markSrc: string
        /** The notice drawn in place of the page for a member who may not read it. */
        readonly refusal?: ComponentProps<typeof ConnectionRefusedPage>["props"]
    }
    readonly on: ConnectionPageHeadCommands
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

/**
 * Draws a provider connection page as one page with no tabs (`Page chrome="panes"`): the header band (mark, name, status, facts, one
 * command), then a main pane of bands (notices, the page's own bands, disconnect) beside the live rail, which becomes a drawer on a
 * narrow screen. Disconnect asks first.
 */
export const ConnectionPageHeadBase = (props: ConnectionPageHeadBaseProps) => {
    if (props.props.refusal !== undefined) return <ConnectionRefusedPage props={props.props.refusal} />
    const head = props.props.head
    const view = head ?? HEAD_PLACEHOLDER
    const { rail, action, disconnect } = props.props
    return (
        <>
            <Page
                chrome="panes"
                measure="product"
                isSkeleton={props.props.isSkeleton}
                header={{
                    breadcrumbs: { label: props.props.crumbLabel, items: props.props.crumbs },
                    mark: <ProviderLogo glyph={props.props.icon} src={props.props.markSrc} />,
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
                }}
            >
                <PaneGrid
                    label={props.props.gridLabel}
                    areas={{ base: ["main"], medium: ["main rail"] }}
                    columns={{ base: ["fill"], medium: ["fill", "standard"] }}
                >
                    <Pane area="main" surface scroll label={props.props.mainLabel}>
                        <NoticesBand props={props.props} on={props.on} />
                        {head === undefined && !props.props.isSkeleton ? null : props.shape.main}
                        {disconnect === undefined ? null : (
                            <ConnectionDisconnectBand {...disconnect} onPress={props.on.askDisconnect} />
                        )}
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
            <ConnectionDisconnectDialog
                confirm={props.props.confirm}
                onConfirm={props.on.confirmDisconnect}
                onDismiss={props.on.dismiss}
            />
        </>
    )
}
