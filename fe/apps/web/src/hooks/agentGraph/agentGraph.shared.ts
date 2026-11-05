import type { useQueryAgentGraphRunSwr, useQueryAgentGraphSwr, useQueryApproverDirectorySwr } from "@/hooks/swr"
import { parseAgentGraphTrace } from "@/modules/agent-graph"
import type { AgentGraphSetupState, AgentGraphWire } from "@/modules/agent-graph"
import type {
    AgentGraphAction,
    AgentGraphCommands,
    AgentGraphMemberData,
    AgentGraphPhoneView,
    AgentGraphSideTab,
    SlotRead,
} from "@/modules/types"

/** The tabs of the pane beside the graph, in the order they are offered. */
export const SIDE_TABS: ReadonlyArray<AgentGraphSideTab> = ["chat", "detail", "proposals", "versions"]

/** The views the phone offers in place of two panes, in the order they are offered. */
export const PHONE_VIEWS: ReadonlyArray<AgentGraphPhoneView> = ["checklist", "graph", "chat", "proposals", "versions"]

/** Runs the command an action names. */
export const performAgentGraphAction = (commands: AgentGraphCommands, action: AgentGraphAction): void => {
    switch (action.kind) {
        case "select":
            return commands.select(action.value)
        case "sideTab":
            return commands.sideTab(action.value)
        case "phoneView":
            return commands.phoneView(action.value)
        case "openNode":
            return commands.openNode(action.value)
        case "mode":
            return commands.mode(action.value)
        case "restore":
            return commands.restore(action.value)
        case "edit":
            return commands.edit(action.value)
        case "form":
            return commands.change(action.change)
        case "adderPick":
            return commands.pickAdder(action.field, action.value)
        case "addDecide":
            return commands.addDecide(action.action, action.fact)
        case "decide":
            return commands.decide(action.value, action.isConfirmed)
        case "closeDrawer":
            return commands.closeDrawer()
        case "save":
            return commands.save()
        case "cancel":
            return commands.cancel()
        case "publish":
            return commands.publish()
        case "trace":
            return commands.trace()
        case "untrace":
            return commands.untrace()
    }
}

/** The checklist of the setup and the command that applies it: "Publish and run" does the checklist and the map in one press. */
export interface AgentGraphSetup extends AgentGraphSetupState {
    readonly apply: () => Promise<void>
}

/** The run a work item left on the graph: its decision, version, outcome and the steps of its trace; null while none is read. */
export const agentGraphRunOf = (
    data: ReturnType<typeof useQueryAgentGraphRunSwr>["data"],
): {
    id: string
    version: number
    outcome: string
    closedAs: string | null
    steps: readonly {
        key: string
        title: string
        kind: "trigger" | "output" | "condition" | "execute"
        step: string
        branchKey: string | null
    }[]
} | null =>
    data === undefined
        ? null
        : {
              id: data.decisionId,
              version: data.version,
              outcome: data.outcome,
              closedAs: data.closedAs,
              steps: parseAgentGraphTrace(data.traceJson) ?? [],
          }

/** The people an approver can be: everyone in the directory who is not disabled. */
export const agentGraphMembersOf = (
    directory: ReturnType<typeof useQueryApproverDirectorySwr>["data"],
): ReadonlyArray<AgentGraphMemberData> | undefined =>
    directory
        ?.filter((member) => member.status !== "disabled")
        .map((member) => ({ id: member.memberId, name: member.name, upToVnd: null }))

/** The graph read, settled only when its payload parsed: a payload that does not parse is an error, not data. */
export const parsedGraphReadOf = (
    graph: ReturnType<typeof useQueryAgentGraphSwr>,
    wire: AgentGraphWire | null | undefined,
): SlotRead<typeof graph.data> => ({
    data: wire === null ? undefined : graph.data,
    error: graph.error ?? (wire === null ? new Error("The agent graph payload is invalid") : undefined),
    isLoading: graph.isLoading,
    isValidating: graph.isValidating,
})
