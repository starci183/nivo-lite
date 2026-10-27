import { Alert, Badge, Select, SurfaceCard, Text, TextAction } from "@starci/grammar/common"
import { SlotView } from "@/components/composites/SlotView"
import type { DataSlot, SlotLabels } from "@/modules/types"
import { ACTIONS, STACK } from "./classNames"

/** One connection of the workspace this agent can work through. */
export interface AgentConnectionAccessRow {
    readonly id: string
    readonly label: string
    readonly statusLabel: string
    readonly statusTone: "success" | "danger" | "warning" | "neutral"
    /** What this agent does through the connection; empty when it is only a data source. */
    readonly purposeLabel: string
    /** The access level of this agent, "none" when it has none. */
    readonly access: string
    /** The connection is disconnected: only "none" can be picked. */
    readonly isDisconnected: boolean
}

/** Copy and state of the connection access card of an agent. */
export interface AgentConnectionAccessBaseProps {
    readonly props: {
        readonly title: string
        readonly hint: string
        readonly slot: DataSlot<ReadonlyArray<AgentConnectionAccessRow>>
        readonly placeholder: ReadonlyArray<AgentConnectionAccessRow>
        readonly slotLabels: SlotLabels
        readonly manageLabel: string
        readonly manageHref: string
        readonly ownerOnlyText: string
        readonly levels: ReadonlyArray<{ readonly id: string; readonly label: string }>
        readonly canEdit: boolean
        readonly isDisabled: boolean
        /** Why the agent cannot reach anyone yet; empty when nothing is missing. */
        readonly notice: string
    }
    readonly on: { readonly pick: (connectionId: string, level: string | null) => void }
}

/** Draws the connections an agent uses, each with its access level. */
export const AgentConnectionAccessBase = (props: AgentConnectionAccessBaseProps) => (
    <SurfaceCard label={props.props.title} headingLevel={2}>
        <div className={STACK}>
            <Text size="sm" tone="muted">
                {props.props.hint}
            </Text>
            <SlotView slot={props.props.slot} placeholder={props.props.placeholder} labels={props.props.slotLabels}>
                {(rows, isSkeleton) => (
                    <>
                        {rows.map((row) => (
                            <div key={row.id} className={ACTIONS}>
                                <Select
                                    label={row.label}
                                    description={
                                        <>
                                            <Badge isDot tone={row.statusTone}>
                                                {row.statusLabel}
                                            </Badge>
                                            {row.purposeLabel === "" ? null : (
                                                <Text size="xs" tone="muted">
                                                    {row.purposeLabel}
                                                </Text>
                                            )}
                                        </>
                                    }
                                    options={props.props.levels.map((level) => ({
                                        ...level,
                                        isDisabled: row.isDisconnected && level.id !== "none",
                                    }))}
                                    value={row.access}
                                    onValueChange={(level) => props.on.pick(row.id, level)}
                                    isDisabled={props.props.isDisabled || isSkeleton}
                                />
                            </div>
                        ))}
                    </>
                )}
            </SlotView>
            {props.props.notice === "" ? null : <Alert tone="informative" title={props.props.notice} />}
            <div className={ACTIONS}>
                <TextAction href={props.props.manageHref} size="sm" appearance="inline">
                    {props.props.manageLabel}
                </TextAction>
                {props.props.canEdit ? null : (
                    <Text size="xs" tone="muted">
                        {props.props.ownerOnlyText}
                    </Text>
                )}
            </div>
        </div>
    </SurfaceCard>
)
