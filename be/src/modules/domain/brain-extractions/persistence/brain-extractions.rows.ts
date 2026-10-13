import type { ExtractionStatus } from "../brain-extractions.contracts"

/** One row of public.brain_extractions. */
export interface BrainExtractionRow {
    /** The document. */
    readonly source_id: string
    /** The workspace. */
    readonly workspace_id: string
    /** Where the reading stands. */
    readonly status: ExtractionStatus
    /** Facts filed. */
    readonly facts_proposed: number
    /** The prompt version. */
    readonly prompt_version: number
    /** The hash of the text read. */
    readonly content_hash: string | null
    /** Windows the document has. */
    readonly windows_total: number
    /** Windows read. */
    readonly windows_done: number
    /** Failed tries in a row. */
    readonly attempts: number
    /** Active facts that lost their evidence. */
    readonly orphan_fact_ids: ReadonlyArray<string> | null
}
