import type { Locale } from "@modules/platform/i18n"

/** What the runs of one agent instance take. */
export interface ReadAgentRunsRequest {
    /** The workspace the caller names in X-Workspace-Id; the service proves their role. */
    readonly workspaceId: string
    /** The agent instance the runs are about. */
    readonly installationId: string
}

/** What one run of an agent instance takes. */
export interface ReadAgentRunRequest extends ReadAgentRunsRequest {
    /** The run. */
    readonly runId: string
    /** The language the page reads in: the words of each kind of AI call (`AgentRunAiCall.label`); Vietnamese when absent. */
    readonly locale?: Locale | undefined
}
