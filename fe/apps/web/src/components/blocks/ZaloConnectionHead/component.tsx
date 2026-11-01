import { Alert, Badge, Button, Page, Pane, PaneGrid, PaneSection } from "@starci/grammar/common"
import type { BreadcrumbItem, PresentationState } from "@starci/grammar/common"
import type { ComponentProps, ReactNode } from "react"
import { ProviderLogo } from "@/components/branches/ProviderLogo"
import { ConnectionDisconnectBand } from "@/components/composites/ConnectionDisconnectBand"
import { ConnectionDisconnectDialog } from "@/components/composites/ConnectionDisconnectDialog"
import { ConnectionRefusedPage } from "@/components/composites/ConnectionRefusedPage"
import { SlotView } from "@/components/composites/SlotView"
import type { DataSlot, SlotLabels, ZaloHeadView } from "@/modules/types"

/** Fake data of the same shape: the skeleton reuses the ready tree. */
export const ZALO_HEAD_PLACEHOLDER: ZaloHeadView = {
    name: "-",
    chipLabel: "-",
    chipTone: "neutral",
    facts: "-",
    banner: "",
}

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
    /** The bands of the main pane (health, setup steps, ZNS) and of the live rail, connected by the page. */
    readonly shape: { readonly main: ReactNode; readonly rail: ReactNode }
    readonly props: {
        readonly head: DataSlot<ZaloHeadView>
        /** The provider's own mark. */
        readonly markSrc: string
        /** The notice drawn in place of the page for a member who may not read it. */
        readonly refusal?: ComponentProps<typeof ConnectionRefusedPage>["props"]
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
    }
}

/** What a band of the main pane reads: the copy and the commands, never the bands the page places. */
type ZaloBandProps = Pick<ZaloConnectionHeadBaseProps, "props" | "on">

/** The read failed or was refused: the main pane says so in place, in its first band. */
const isFailed = (slot: DataSlot<ZaloHeadView>): boolean => slot.isError === true || slot.isForbidden === true

const NoticesBand = (props: ZaloBandProps) => {
    const { head, notices } = props.props
    if (!isFailed(head) && notices.length === 0) return null
    return (
        <PaneSection>
            {isFailed(head) ? (
                <SlotView
                    slot={head}
                    placeholder={ZALO_HEAD_PLACEHOLDER}
                    labels={props.props.slotLabels}
                    forbidden="notice"
                    onRetry={props.on.retry}
                >
                    {() => null}
                </SlotView>
            ) : null}
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

/**
 * Draws the page of the OA as one page with no tabs (`Page chrome="panes"`): the header band (mark, name, status, facts, "Check
 * again"), then a main pane of bands (notices, health, the numbered setup steps, ZNS, disconnect) beside the live events rail, which
 * becomes a drawer on a narrow screen. Disconnect asks first.
 */
export const ZaloConnectionHeadBase = (props: ZaloConnectionHeadBaseProps) => {
    if (props.props.refusal !== undefined) return <ConnectionRefusedPage props={props.props.refusal} />
    const head = props.props.head.items
    const view = head ?? ZALO_HEAD_PLACEHOLDER
    const { rail } = props.props
    return (
        <>
            <Page
                chrome="panes"
                measure="product"
                isSkeleton={props.props.head.isLoading === true}
                header={{
                    breadcrumbs: { label: props.props.crumbLabel, items: props.props.crumbs },
                    mark: <ProviderLogo glyph="chat" src={props.props.markSrc} />,
                    title: view.name,
                    status: (
                        <Badge isDot tone={view.chipTone}>
                            {view.chipLabel}
                        </Badge>
                    ),
                    meta: view.facts,
                    actions:
                        head === undefined ? undefined : (
                            <Button intent="neutral" isPending={props.props.isRechecking} onPress={props.on.recheck}>
                                {props.props.recheckLabel}
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
                        {head === undefined && isFailed(props.props.head) ? null : props.shape.main}
                        {props.props.disconnect === undefined ? null : (
                            <ConnectionDisconnectBand {...props.props.disconnect} onPress={props.on.askDisconnect} />
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
