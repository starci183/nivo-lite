import { Alert, Badge, Select, SurfaceCard, Text, TextAction } from "@starci/grammar/common"
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
        readonly emptyText: string
        readonly manageLabel: string
        readonly manageHref: string
        readonly ownerOnlyText: string
        readonly levels: ReadonlyArray<{ readonly id: string; readonly label: string }>
        readonly rows: ReadonlyArray<AgentConnectionAccessRow>
        readonly canEdit: boolean
        readonly isDisabled: boolean
        readonly noteTone: "idle" | "saved" | "refused"
        readonly noteText: string
    }
    readonly on: { readonly pick: (connectionId: string, level: string | null) => void }
}

/** Draws the connections an agent uses, each with its access level, and the result of the last change. */
export const AgentConnectionAccessBase = (props: AgentConnectionAccessBaseProps) => (
    <SurfaceCard label={props.props.title} headingLevel={2}>
        <div className={STACK}>
            <Text size="sm" tone="muted">
                {props.props.hint}
            </Text>
            {props.props.rows.length === 0 ? <Text size="sm">{props.props.emptyText}</Text> : null}
            {props.props.rows.map((row) => (
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
                        isDisabled={props.props.isDisabled}
                    />
                </div>
            ))}
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
            {props.props.noteTone === "idle" ? null : (
                <Alert
                    title={props.props.noteText}
                    tone={props.props.noteTone === "saved" ? "affirmative" : "negative"}
                />
            )}
        </div>
    </SurfaceCard>
)
