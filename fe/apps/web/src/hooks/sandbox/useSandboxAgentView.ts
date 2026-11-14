"use client"

import { mapSlot } from "@/hooks/slot"
import { useQueryAgentsSwr, useQueryProviderRightsSwr, type useQuerySandboxAccountsSwr } from "@/hooks/swr"
import { agentsDataOf, sandboxAgentChoicesOf, selectedAccountOf } from "@/modules/sandbox"
import { slotOfSandboxRead } from "./sandbox.shared"
import { useSandboxAgentCommands, type SandboxAgentCommands } from "./useSandboxAgentCommands"
import { useSandboxAgentState, type SandboxAgentState } from "./useSandboxAgentState"
import type { SandboxPanesBaseProps } from "@/modules/types"

/** What the agent blocks of the page need to know. */
interface SandboxAgentViewInput {
    readonly isOn: boolean
    /** The open-account drawer shows: it lists the agents too. */
    readonly isOpenDrawerShown: boolean
    readonly accountsRead: ReturnType<typeof useQuerySandboxAccountsSwr>
    readonly chosenId: string | null
    readonly locale: string
}

/** The agent half of the Sandbox view: the blocks it draws, the choice list of the open-account drawer, the state and the commands. */
export interface SandboxAgentView {
    readonly agents: SandboxPanesBaseProps["props"]["agents"]
    readonly attach: SandboxPanesBaseProps["props"]["attach"]
    readonly detachAsk: SandboxPanesBaseProps["props"]["detachAsk"]
    /** Every agent, for the drawer that opens an account. */
    readonly openChoices: SandboxPanesBaseProps["props"]["open"]["agents"]
    readonly state: SandboxAgentState
    readonly commands: SandboxAgentCommands
    readonly retry: () => void
}

/**
 * The agents of the open account (with the default each holds among several accounts of the provider), the agents it could still be
 * given to, and the agent a detach is asked about. The agents of the workspace are read only while a drawer that lists them shows.
 */
export const useSandboxAgentView = (input: SandboxAgentViewInput): SandboxAgentView => {
    const state = useSandboxAgentState()
    const commands = useSandboxAgentCommands()
    const agentsRead = useQueryAgentsSwr(input.isOn && (input.isOpenDrawerShown || state.isAttachOpen) ? {} : null)
    const rightsRead = useQueryProviderRightsSwr(input.isOn)
    const selected = selectedAccountOf(input.accountsRead.data, input.chosenId)
    const choices = (except: ReadonlyArray<string>) =>
        mapSlot(slotOfSandboxRead(agentsRead), (wire) => sandboxAgentChoicesOf(wire, except, input.locale))
    const detachAsked = selected?.agents.find((agent) => agent.id === state.detachAskId)
    return {
        agents: mapSlot(slotOfSandboxRead(input.accountsRead), (wire) => {
            const account = selectedAccountOf(wire, input.chosenId)
            return account === undefined ? { rows: [] } : agentsDataOf(account, rightsRead.data?.attachments)
        }),
        attach: {
            isOpen: state.isAttachOpen,
            isPending: commands.isAttaching,
            agents: choices((selected?.agents ?? []).map((agent) => agent.id)),
            agentIds: state.attachIds,
        },
        detachAsk: detachAsked === undefined ? null : { agentId: detachAsked.id, name: detachAsked.label },
        openChoices: choices([]),
        state,
        commands,
        retry: () => void agentsRead.mutate(),
    }
}
