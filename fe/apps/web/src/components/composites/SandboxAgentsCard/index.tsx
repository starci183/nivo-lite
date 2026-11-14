import { Button, SurfaceCard, Text, type BadgeData, type ListRowData } from "@starci/grammar/common"
import { sandboxCardStateOf } from "@/components/branches/SandboxCardState"
import type { DataSlot, SandboxAgentRowView, SandboxAgentsData, SandboxCopy, SandboxPendingView } from "@/modules/types"

/** What the agents card draws and does. */
interface SandboxAgentsCardProps {
    readonly copy: SandboxCopy
    readonly slot: DataSlot<SandboxAgentsData>
    readonly pending: SandboxPendingView
    readonly on: {
        readonly attach: () => void
        readonly detach: (agentId: string) => void
        readonly setDefault: (agentId: string) => void
        readonly retry: () => void
    }
}

/** The card while the agents are read: two rows of the shape of the real ones. */
const PLACEHOLDER: SandboxAgentsData = {
    rows: ["a", "b"].map((id) => ({ id: `agent:${id}`, name: " ", isDefault: false, canSetDefault: false })),
}

/** No agent at all. */
const NONE: SandboxAgentsData = { rows: [] }

/** The plain Badge of the agent's default account (no dot: it is a label, not a live status). */
const badgesOf = (row: SandboxAgentRowView, copy: SandboxCopy["agents"]): ListRowData["badges"] => {
    const badge: BadgeData = { label: copy.defaultBadge }
    return row.isDefault ? [badge] : undefined
}

/** One agent as a row: its name, the mark when this is its default account, "make default" where it holds several, and "detach" at the end. */
const rowOf = (row: SandboxAgentRowView, props: SandboxAgentsCardProps): ListRowData => {
    const badges = badgesOf(row, props.copy.agents)
    return {
        id: row.id,
        title: row.name,
        ...(badges === undefined ? {} : { badges }),
        actionPlacement: "end",
        ...(row.canSetDefault
            ? {
                  control: (
                      <Button
                          intent="neutral"
                          size="sm"
                          isPending={props.pending.defaultingId === row.id}
                          onPress={() => props.on.setDefault(row.id)}
                      >
                          {props.copy.agents.makeDefaultLabel}
                      </Button>
                  ),
              }
            : {}),
        action: {
            label: props.copy.agents.detachLabel,
            press: () => props.on.detach(row.id),
            isPending: props.pending.detachingId === row.id,
        },
    }
}

/**
 * The agents the open account is attached to, one row each, with the one command that gives the account to more agents at the foot.
 * Where an agent holds several accounts of this provider, its default one wears a plain Badge and the others offer "make default".
 */
export const SandboxAgentsCard = (props: SandboxAgentsCardProps) => {
    const state = sandboxCardStateOf(props.slot, PLACEHOLDER, NONE, {
        message: props.copy.agents.errorTitle,
        retryLabel: props.copy.retryLabel,
        onRetry: props.on.retry,
    })
    return (
        <SurfaceCard
            kind="list"
            label={props.copy.agents.title}
            headingLevel={2}
            isLoading={state.isLoading}
            {...(state.error === undefined ? {} : { error: state.error })}
            {...(state.isLoading || state.data.rows.length === 0 ? {} : { count: state.data.rows.length })}
            footers={[
                {
                    kind: "custom",
                    children: (
                        <Button intent="neutral" size="sm" isDisabled={state.isLoading} onPress={props.on.attach}>
                            {props.copy.agents.attachLabel}
                        </Button>
                    ),
                },
            ]}
            items={state.data.rows.map((row) => rowOf(row, props))}
            empty={<Text tone="muted">{props.copy.agents.empty}</Text>}
        />
    )
}
