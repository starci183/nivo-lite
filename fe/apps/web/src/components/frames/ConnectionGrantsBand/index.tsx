import { SlotView } from "@nivo-lite/agent-sdk/client"
import { ConnectionGrantRows } from "@/components/composites/ConnectionGrantRows"
import type { ConnectionGrantsView, DataSlot, SlotLabels } from "@/modules/types"

/** The words and the state of the agents-of-a-connection section. */
export interface ConnectionGrantsBandProps {
    readonly props: {
        readonly title: string
        readonly assignLabel: string
        readonly emptyMessage: string
        readonly slot: DataSlot<ConnectionGrantsView>
        readonly labels: SlotLabels
        /** The agents stand on the page well as their own card (a connection page's agents region). */
        readonly isCard?: boolean
    }
    readonly on: {
        readonly remove: (agentId: string) => void
        readonly assign: (agentId: string) => void
        readonly retry: () => void
    }
}

/** The geometry of the ready section while the read waits: three agents. */
const PLACEHOLDER: ConnectionGrantsView = {
    canManage: false,
    removeLabel: "",
    rows: ["a", "b", "c"].map((id) => ({ id, name: "" })),
    candidates: [],
}

/** Draws the agents bound to one connection, the command that unbinds each, and the control that binds another agent. */
export const ConnectionGrantsBand = (props: ConnectionGrantsBandProps) => (
    <SlotView
        slot={props.props.slot}
        placeholder={PLACEHOLDER}
        labels={props.props.labels}
        onRetry={props.on.retry}
        render={(view, isLoading) => (
            <ConnectionGrantRows
                title={props.props.title}
                rows={view.rows.map((row) => ({
                    id: row.id,
                    title: row.name,
                    leading: { avatar: { name: row.name, seed: row.id, kind: "agent" as const } },
                }))}
                removeLabel={view.removeLabel}
                canManage={view.canManage}
                assign={{
                    label: props.props.assignLabel,
                    options: view.candidates,
                    onAssign: props.on.assign,
                }}
                emptyMessage={props.props.emptyMessage}
                isLoading={isLoading}
                onRemove={props.on.remove}
                isCard={props.props.isCard === true}
            />
        )}
    />
)
