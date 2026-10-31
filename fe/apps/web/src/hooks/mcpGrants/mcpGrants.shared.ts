/** One agent's switch for one tool. */
interface McpAgentSwitchView {
    readonly id: string
    readonly name: string
    readonly isOn: boolean
    readonly isDisabled: boolean
    readonly onToggle: (isOn: boolean) => void
}

/** The agents a tool can be switched on for. */
export interface McpToolAgentsView {
    readonly label: string
    readonly switchLabel: string
    readonly rows: ReadonlyArray<McpAgentSwitchView>
}

/** The switches of one tool by its name; nothing for a tool that cannot be switched on yet (a connector nobody approved). */
export type McpToolAgentsOf = (tool: string) => McpToolAgentsView | undefined

/** The key of one agent and one tool, which is also the key of its switch. */
export const grantKeyOf = (agentId: string, tool: string): string => `${agentId}:${tool}`

/** The switches of a tool as the row carries them, or nothing. */
export const agentsRowOf = (agents: McpToolAgentsView | undefined): { readonly agents?: McpToolAgentsView } =>
    agents === undefined ? {} : { agents }
