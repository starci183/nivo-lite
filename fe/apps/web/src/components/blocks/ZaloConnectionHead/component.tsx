import { Alert, AlertDialog, Badge, Button, IconTile, Page } from "@starci/grammar/common"
import type { BreadcrumbItem } from "@starci/grammar/common"
import type { ReactNode } from "react"
import { nivoIconSource } from "@/components/leaves/Icon"
import { SlotView } from "@/components/composites/SlotView"
import type { DataSlot, SlotLabels, ZaloHeadView } from "@/modules/types"
import { ACTIONS, BODY, NOTICES } from "./classNames"

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
    /** The page body under the notices: the tab body and the docked events panel. */
    readonly shape: { readonly body: ReactNode }
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

/** Draws the page of the OA: one `Page` whose header is the OA band (mark, status, facts, actions, tabs), whose body opens with the banner that says why it cannot send, and the disconnect confirmation. */
export const ZaloConnectionHeadBase = (props: ZaloConnectionHeadBaseProps) => {
    const head = props.props.head.items
    const view = head ?? ZALO_HEAD_PLACEHOLDER
    const isSkeleton = head === undefined
    return (
        <>
            <Page
                measure="product"
                isSkeleton={isSkeleton}
                header={{
                    breadcrumbs: { label: props.props.crumbLabel, items: props.props.crumbs },
                    mark: <IconTile source={nivoIconSource("chat", "leading")} tone="accent" size="md" />,
                    title: view.name,
                    status: (
                        <Badge isDot tone={view.chipTone}>
                            {view.chipLabel}
                        </Badge>
                    ),
                    meta: view.facts,
                    actions: (
                        <div className={ACTIONS}>
                            <Button intent="commit" onPress={props.on.reconnect}>
                                {props.props.reconnectLabel}
                            </Button>
                            <Button intent="destructive" step="entry" onPress={props.on.askDisconnect}>
                                {props.props.disconnectLabel}
                            </Button>
                        </div>
                    ),
                    tabs: {
                        label: props.props.tabsLabel,
                        selectedKey: props.props.selectedTab,
                        labelVisibility: "always",
                        items: props.props.tabs,
                        onSelect: props.on.selectTab,
                    },
                }}
            >
                <div className={BODY}>
                    <div className={NOTICES}>
                        <SlotView
                            slot={props.props.head}
                            placeholder={ZALO_HEAD_PLACEHOLDER}
                            labels={props.props.slotLabels}
                            forbidden="notice"
                            onRetry={props.on.retry}
                        >
                            {(ready) => (ready.banner === "" ? null : <Alert tone="negative" title={ready.banner} />)}
                        </SlotView>
                        {props.props.notice === "" ? null : <Alert tone="negative" title={props.props.notice} />}
                    </div>
                    {props.shape.body}
                </div>
            </Page>
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
        </>
    )
}
