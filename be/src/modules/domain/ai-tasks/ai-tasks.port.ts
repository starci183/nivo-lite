import type { Locale } from "@modules/platform/i18n"
import type { MeterEntry, OptionalQuotaNotice, RecalledPassage, RecallRequest } from "./ai-tasks.contracts"

/** The plan allowance and the usage meter a prompt run on the AI endpoint goes through; the app root binds it to the usage gate. */
export interface AiTaskMeter {
    /** The notice when the workspace has used its allowance for the kind. */
    blockedBy(workspaceId: string, kind: string, locale: Locale): Promise<OptionalQuotaNotice>
    /** Meters one finished generation. */
    record(entry: MeterEntry): Promise<void>
}

/** The Second Brain a drafting task reads business notes from; the app root binds it to the agent knowledge lens. */
export interface AiTaskRecall {
    /** The passages the lane may read for the question, best first; the lane filter is applied by the owner of the knowledge. */
    notes(request: RecallRequest): Promise<ReadonlyArray<RecalledPassage>>
}
