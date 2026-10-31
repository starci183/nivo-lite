import { Badge, List, ListRow, Switch } from "@starci/grammar/common"
import type { ConnectionAgentRowView } from "@/modules/types"

/** Props for {@link ConnectionAgentSwitches}. */
type ConnectionAgentSwitchesProps = {
    readonly title: string
    readonly agents: ReadonlyArray<ConnectionAgentRowView>
    readonly isSkeleton: boolean
    readonly switchLabel: string
    /** What a non-owner reads in place of the switch on an agent that works through the connection. */
    readonly onLabel: string
    /** Only the owner may change which agents work through the connection. */
    readonly canToggle: boolean
    readonly onToggle: (agentId: string, isOn: boolean) => void
}

/** What a non-owner reads in place of the switch: a badge on an agent that works through the connection, nothing on the others. */
const readOnlyMark = (agent: ConnectionAgentRowView, label: string) =>
    agent.isOn ? <Badge tone="success">{label}</Badge> : undefined

/** The agents that may work through a connection, each with a switch for whether it does (a badge for everyone but the owner). */
export const ConnectionAgentSwitches = (props: ConnectionAgentSwitchesProps) => (
    <List label={props.title} aria-busy={props.isSkeleton}>
        {props.agents.map((agent) => (
            <ListRow
                key={agent.id}
                title={agent.name}
                isSkeleton={props.isSkeleton}
                actions={
                    props.canToggle ? (
                        <Switch
                            name={`agent-${agent.id}`}
                            label={`${props.switchLabel} ${agent.name}`}
                            isLabelHidden
                            isSelected={agent.isOn}
                            isSkeleton={props.isSkeleton}
                            onSelectedChange={(isOn) => props.onToggle(agent.id, isOn)}
                        />
                    ) : (
                        readOnlyMark(agent, props.onLabel)
                    )
                }
            />
        ))}
    </List>
)
