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
    }
    readonly on: {
        readonly pick: (agentId: string, level: string) => void
        readonly assign: (agentId: string) => void
        readonly retry: () => void
    }
}

/** The geometry of the ready section while the read waits: three agents with a picker each. */
const PLACEHOLDER: ConnectionGrantsView = {
    canManage: false,
    levels: [],
    rows: ["a", "b", "c"].map((id) => ({ id, name: "", levelLabel: "", level: "ask" })),
    candidates: [],
}

/**
 * Draws who works through one connection and how far: each agent with its level picker (read only, ask first, act, remove), and the
 * control that gives the connection to another agent.
 */
export const ConnectionGrantsBand = (props: ConnectionGrantsBandProps) => (
    <>
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
                        levelLabel: row.levelLabel,
                        level: row.level,
                    }))}
                    levels={view.levels}
                    canManage={view.canManage}
                    assign={{
                        label: props.props.assignLabel,
                        options: view.candidates,
                        onAssign: props.on.assign,
                    }}
                    emptyMessage={props.props.emptyMessage}
                    isLoading={isLoading}
                    onPick={props.on.pick}
                />
            )}
        />
    </>
)
