import type { AgentGraphAction, AgentGraphCommands, AgentGraphPhoneView, AgentGraphSideTab } from "@/modules/types"

/** The tabs of the pane beside the graph, in the order they are offered. */
export const SIDE_TABS: ReadonlyArray<AgentGraphSideTab> = ["chat", "detail", "proposals", "versions"]

/** The views the phone offers in place of two panes, in the order they are offered. */
export const PHONE_VIEWS: ReadonlyArray<AgentGraphPhoneView> = ["branches", "graph", "chat", "proposals", "versions"]

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
        case "field":
            return commands.field(action.name, action.value)
        case "decide":
            return commands.decide(action.value, action.isConfirmed)
        case "closeDrawer":
            return commands.closeDrawer()
        case "edit":
            return commands.edit()
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
