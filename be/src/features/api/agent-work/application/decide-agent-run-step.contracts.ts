import type { AgentRunVerdict } from "@modules/domain/agent-pages"
import type { Locale } from "@modules/platform/i18n"

/** What answering the decision of a run takes. */
export interface DecideAgentRunStepRequest {
    /** The workspace the caller names in X-Workspace-Id; the service proves their role. */
    readonly workspaceId: string
    /** The agent instance. */
    readonly installationId: string
    /** The run. */
    readonly runId: string
    /** The answer. */
    readonly verdict: AgentRunVerdict
    /** The step whose approval is answered, for a run on a thread; absent: the run's newest open approval. */
    readonly stepKey?: string | null | undefined
    /** The language of the generated text. */
    readonly locale: Locale
}
