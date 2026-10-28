import { Alert, AlertDialog, Badge, Breadcrumbs, Button, SectionHeader, Tabs } from "@starci/grammar/common"
import type { BreadcrumbItem } from "@starci/grammar/common"
import { SlotView } from "@/components/composites/SlotView"
import type { DataSlot, SlotLabels, ZaloHeadView } from "@/modules/types"
import { ACTIONS, HEAD } from "./classNames"

/** Fake data of the same shape: the skeleton reuses the ready tree. */
export const ZALO_HEAD_PLACEHOLDER: ZaloHeadView = {
    name: "-",
    chipLabel: "-",
    chipTone: "neutral",
    facts: "-",
    banner: "",
}

/** The confirmation of a disconnect. */
export interface ZaloDisconnectConfirm {
    readonly isOpen: boolean
    readonly title: string
    readonly confirmLabel: string
    readonly cancelLabel: string
    readonly isPending: boolean
}

/** Copy, slot and commands of the header of a Zalo OA connection. */
export interface ZaloConnectionHeadBaseProps {
    readonly props: {
        readonly head: DataSlot<ZaloHeadView>
        readonly slotLabels: SlotLabels
        readonly crumbLabel: string
        readonly crumbs: ReadonlyArray<BreadcrumbItem>
        readonly reconnectLabel: string
        readonly disconnectLabel: string
        readonly tabsLabel: string
        readonly tabs: ReadonlyArray<{ readonly id: string; readonly label: string }>
        readonly selectedTab: string
        /** A refusal of reconnect or disconnect, worded by the back end; empty when there is none. */
        readonly notice: string
        readonly confirm: ZaloDisconnectConfirm
    }
    readonly on: {
        readonly reconnect: () => void
        readonly askDisconnect: () => void
        readonly confirmDisconnect: () => void
        readonly dismiss: () => void
        readonly selectTab: (id: string) => void
        readonly retry: () => void
    }
}

/** Draws the trail, the OA with its status and actions, the banner that says why it cannot send, and the tabs. */
export const ZaloConnectionHeadBase = (props: ZaloConnectionHeadBaseProps) => (
    <div className={HEAD}>
        <Breadcrumbs label={props.props.crumbLabel} items={props.props.crumbs} />
        <SlotView
            slot={props.props.head}
            placeholder={ZALO_HEAD_PLACEHOLDER}
            labels={props.props.slotLabels}
            forbidden="notice"
            onRetry={props.on.retry}
        >
            {(head, isSkeleton) => (
                <>
                    <SectionHeader
                        level={1}
                        title={head.name}
                        description={head.facts}
                        isSkeleton={isSkeleton}
                        action={
                            <div className={ACTIONS}>
                                <Badge isDot tone={head.chipTone} isSkeleton={isSkeleton}>
                                    {head.chipLabel}
                                </Badge>
                                <Button intent="commit" isSkeleton={isSkeleton} onPress={props.on.reconnect}>
                                    {props.props.reconnectLabel}
                                </Button>
                                <Button
                                    intent="destructive"
                                    step="entry"
                                    isSkeleton={isSkeleton}
                                    onPress={props.on.askDisconnect}
                                >
                                    {props.props.disconnectLabel}
                                </Button>
                            </div>
                        }
                    />
                    {head.banner === "" ? null : <Alert tone="negative" title={head.banner} />}
                </>
            )}
        </SlotView>
        {props.props.notice === "" ? null : <Alert tone="negative" title={props.props.notice} />}
        <Tabs
            variant="primary"
            label={props.props.tabsLabel}
            selectedKey={props.props.selectedTab}
            inset="none"
            labelVisibility="always"
            items={props.props.tabs}
            onSelect={props.on.selectTab}
        />
        <AlertDialog
            isOpen={props.props.confirm.isOpen}
            onOpenChange={(open) => {
                if (!open) props.on.dismiss()
            }}
            title={props.props.confirm.title}
            tone="negative"
            confirmLabel={props.props.confirm.confirmLabel}
            cancelLabel={props.props.confirm.cancelLabel}
            isConfirmPending={props.props.confirm.isPending}
            onConfirm={props.on.confirmDisconnect}
            onCancel={props.on.dismiss}
        />
    </div>
)
