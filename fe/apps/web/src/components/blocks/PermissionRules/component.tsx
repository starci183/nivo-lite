import { EmptyNotice, type ListRowData, SurfaceCard, type BadgeTone } from "@starci/grammar/common"

import { PermissionRuleDrawer } from "@/components/composites/PermissionRuleDrawer"
import type { PermissionRuleDrawerProps } from "@/components/composites/PermissionRuleDrawer"
import { SlotView } from "@nivo-lite/agent-sdk/client"
import { PermissionGrantsFields, type PermissionGrantsFieldsProps } from "@/components/branches/PermissionGrantsFields"
import type { DataSlot, SlotLabels } from "@/modules/types"

/** One rule of the list, every word already resolved. */
export interface PermissionRowView {
    readonly id: string
    readonly title: string
    /** The agents it covers, whom it asks and how they decide, on one line. */
    readonly description: string
    readonly modeLabel: string
    readonly modeTone: BadgeTone
}

/** Copy, rows and state the connected list supplies. */
export interface PermissionRulesBaseProps {
    readonly props: {
        readonly title: string
        readonly editLabel: string
        readonly footnote: string
        /** Staff may read the list but not open a rule. */
        readonly isLocked: boolean
        readonly slot: DataSlot<ReadonlyArray<PermissionRowView>>
        readonly placeholder: ReadonlyArray<PermissionRowView>
        readonly slotLabels: SlotLabels
        /** The drawer while it is open; null when it is closed. */
        readonly drawer: PermissionRuleDrawerProps["props"] | null
        readonly grantsSlot: DataSlot<PermissionGrantsFieldsProps["props"]["grants"]>
        readonly grantsPlaceholder: PermissionGrantsFieldsProps["props"]["grants"]
        readonly grantsLabels: SlotLabels
    }
    readonly on: PermissionRuleDrawerProps["on"] & {
        readonly open: (id: string) => void
        readonly retry: () => void
        readonly retryGrants: () => void
    }
}

/** The rules of the Quyen page: what each agent may do alone, whom it asks and how they decide, one row per kind of work. */
export const PermissionRulesBase = (props: PermissionRulesBaseProps) => {
    const view = props.props
    const drawer = view.drawer
    return (
        <SlotView
            slot={view.slot}
            placeholder={view.placeholder}
            labels={view.slotLabels}
            onRetry={props.on.retry}
            render={(rows, isLoading) => (
                <>
                    <SurfaceCard
                        kind="list"
                        label={view.title}
                        headingLevel={2}
                        footer={view.footnote}
                        empty={<EmptyNotice message={view.slotLabels.empty} />}
                        isLoading={isLoading}
                        items={rows.map(
                            (row) =>
                                ({
                                    id: row.id,
                                    title: row.title,
                                    description: row.description,
                                    badges: [{ label: row.modeLabel, tone: row.modeTone }],
                                    ...(view.isLocked
                                        ? {}
                                        : {
                                              action: {
                                                  label: view.editLabel,
                                                  press: () => props.on.open(row.id),
                                              } as const,
                                          }),
                                }) satisfies ListRowData,
                        )}
                    />
                    {drawer === null ? null : (
                        <PermissionRuleDrawer
                            props={drawer}
                            on={props.on}
                            shape={{
                                grants: (
                                    <SlotView
                                        slot={view.grantsSlot}
                                        placeholder={view.grantsPlaceholder}
                                        labels={view.grantsLabels}
                                        onRetry={props.on.retryGrants}
                                        render={(grants, isLoading) => (
                                            <PermissionGrantsFields
                                                isLoading={isLoading}
                                                props={{ grants, canGrant: drawer.canGrant, copy: drawer.copy }}
                                                on={{ enabled: props.on.grantEnabled, max: props.on.grantMax }}
                                            />
                                        )}
                                    />
                                ),
                            }}
                        />
                    )}
                </>
            )}
        />
    )
}
