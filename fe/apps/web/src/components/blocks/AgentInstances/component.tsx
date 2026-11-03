import { Button, EmptyNotice, Page, Stack, SurfaceCard } from "@starci/grammar/common"
import type { BadgeTone, BreadcrumbItem } from "@starci/grammar/common"
import { SlotView } from "@nivo-lite/agent-sdk/client"
import type { DataSlot, SlotLabels } from "@/modules/types"
import { ConnectionNeeds, type ConnectionNeedsProps } from "@/components/leaves/ConnectionNeeds"
import { AddInstanceDialog } from "@/components/composites/AddInstanceDialog"
import type { AddInstanceDialogProps } from "@/components/composites/AddInstanceDialog"

/** One instance as the list draws it. */
export interface InstanceRowView {
    readonly id: string
    readonly title: string
    readonly description: string
    readonly statusLabel: string
    readonly statusTone: BadgeTone
    /** What a `needs_connection` instance waits for and where to connect it; no lines otherwise. */
    readonly needs: ConnectionNeedsProps
    readonly openHref: string
}

/** Copy and slot of the instances of one agent type. */
export interface AgentInstancesBaseProps {
    readonly props: {
        readonly crumbLabel: string
        readonly crumbs: ReadonlyArray<BreadcrumbItem>
        readonly eyebrow: string
        readonly title: string
        readonly description: string
        /** The add command; null when the person may not add or the type has a single instance. */
        readonly addLabel: string | null
        readonly listLabel: string
        readonly openLabel: string
        readonly isAddDisabled: boolean
        readonly slot: DataSlot<ReadonlyArray<InstanceRowView>>
        readonly placeholder: ReadonlyArray<InstanceRowView>
        readonly slotLabels: SlotLabels
        /** The open add dialog, or null. */
        readonly dialog: AddInstanceDialogProps | null
    }
    readonly on: { readonly add: () => void }
}

/** Draws the instances of an agent type: every instance as a row with its status and Open, and the way to add another one. */
export const AgentInstancesBase = (props: AgentInstancesBaseProps) => {
    const view = props.props
    return (
        <Page
            header={{
                title: view.title,
                description: view.description,
                meta: view.eyebrow,
                breadcrumbs: { label: view.crumbLabel, items: view.crumbs },
            }}
            measure="product"
        >
            <Stack gap="row">
                <SlotView
                    slot={view.slot}
                    placeholder={view.placeholder}
                    labels={view.slotLabels}
                    render={(rows, isLoading) => (
                        <SurfaceCard
                            kind="list"
                            isLoading={isLoading}
                            empty={<EmptyNotice message={view.slotLabels.empty} />}
                            label={view.listLabel}
                            headingLevel={2}
                            labelEnd={
                                view.addLabel === null ? undefined : (
                                    <Button
                                        intent="commit"
                                        size="sm"
                                        isDisabled={view.isAddDisabled}
                                        onPress={props.on.add}
                                    >
                                        {view.addLabel}
                                    </Button>
                                )
                            }
                            items={rows.map((row) => ({
                                id: row.id,
                                title: row.title,
                                description: row.description,
                                badges: [{ label: row.statusLabel, tone: row.statusTone, isDot: true }],
                                action: { label: view.openLabel, href: row.openHref },
                                detail: <ConnectionNeeds {...row.needs} />,
                            }))}
                        />
                    )}
                />
                {view.dialog === null ? null : <AddInstanceDialog props={view.dialog.props} on={view.dialog.on} />}
            </Stack>
        </Page>
    )
}
