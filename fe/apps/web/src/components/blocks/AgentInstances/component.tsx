import { Badge, Button, ListRow, Page, SurfaceListCard } from "@starci/grammar/common"
import type { BadgeTone, BreadcrumbItem } from "@starci/grammar/common"
import { SlotView } from "@/components/composites/SlotView"
import type { DataSlot, SlotLabels } from "@/modules/types"
import { ConnectionNeeds, type ConnectionNeedsProps } from "@/components/leaves/ConnectionNeeds"
import { AddInstanceDialog } from "@/components/composites/AddInstanceDialog"
import type { AddInstanceDialogProps } from "@/components/composites/AddInstanceDialog"
import { PAGE_CLASS_NAME } from "./classNames"

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
            <div className={PAGE_CLASS_NAME}>
                <SurfaceListCard
                    label={view.listLabel}
                    headingLevel={2}
                    labelEnd={
                        view.addLabel === null ? undefined : (
                            <Button intent="commit" size="sm" isDisabled={view.isAddDisabled} onPress={props.on.add}>
                                {view.addLabel}
                            </Button>
                        )
                    }
                >
                    <SlotView slot={view.slot} placeholder={view.placeholder} labels={view.slotLabels}>
                        {(rows, isSkeleton) =>
                            rows.map((row) => (
                                <ListRow
                                    key={row.id}
                                    title={row.title}
                                    description={row.description}
                                    isSkeleton={isSkeleton}
                                    badges={
                                        <Badge isDot tone={row.statusTone} isSkeleton={isSkeleton}>
                                            {row.statusLabel}
                                        </Badge>
                                    }
                                    actions={
                                        <Button size="sm" intent="neutral" href={row.openHref} isSkeleton={isSkeleton}>
                                            {view.openLabel}
                                        </Button>
                                    }
                                >
                                    <ConnectionNeeds {...row.needs} />
                                </ListRow>
                            ))
                        }
                    </SlotView>
                </SurfaceListCard>
                {view.dialog === null ? null : <AddInstanceDialog props={view.dialog.props} on={view.dialog.on} />}
            </div>
        </Page>
    )
}
