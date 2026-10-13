import { Button, DropdownMenu, Text } from "@starci/grammar/common"
import type { DropdownMenuEntry } from "@starci/grammar/common"
import type { AccessAgentView, AccessView } from "@/modules/types"

/** The picker (see AccessView) and the handler of a pick. */
type ConnectionAccessMenuProps = AccessView & {
    readonly onPick: (agentId: string, value: string) => void
}

const SEPARATOR = ":"

const entryOf = (
    agent: AccessAgentView,
    unusableLabel: string,
    onPick: (agentId: string, value: string) => void,
): DropdownMenuEntry => {
    if (!agent.isUsable) {
        return {
            kind: "section",
            id: `agent-${agent.id}`,
            label: agent.name,
            items: [{ id: `${agent.id}${SEPARATOR}unusable`, label: unusableLabel, isDisabled: true }],
        }
    }
    return {
        kind: "section",
        id: `agent-${agent.id}`,
        label: agent.name,
        items: agent.options.map((option) => ({
            id: `${agent.id}${SEPARATOR}${option.value}`,
            label: option.label,
            ...(option.description === undefined ? {} : { description: option.description }),
        })),
        selection: {
            mode: "single",
            selectedIds: [`${agent.id}${SEPARATOR}${agent.current}`],
            onChange: (ids: ReadonlyArray<string>) => {
                const picked = ids[0]?.split(SEPARATOR)[1]
                if (picked !== undefined) onPick(agent.id, picked)
            },
        },
    }
}

/**
 * "Which agents work through this connection, and how far": one menu, one section per agent. Each pick is saved at once by the
 * connected row. Without edit rights the same facts read as one muted line.
 */
export const ConnectionAccessMenu = (props: ConnectionAccessMenuProps) => {
    if (!props.isEditable)
        return (
            <Text size="sm" tone="muted">
                {props.summary}
            </Text>
        )
    const entries = props.agents.map((agent) => entryOf(agent, props.unusableLabel, props.onPick))
    return (
        <DropdownMenu
            placement="bottom end"
            trigger={
                <Button variant="outline" size="sm" isPending={props.isPending}>
                    {props.triggerLabel}
                </Button>
            }
            entries={entries.length > 0 ? entries : [{ id: "no-agents", label: props.emptyLabel, isDisabled: true }]}
        />
    )
}
