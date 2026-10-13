/** A context snapshot of one installed module. */
export interface ContextSnapshotRow {
    readonly summary?: string
    readonly facts?: ReadonlyArray<{ readonly text: string }>
    readonly gates?: Readonly<Record<string, { readonly evidence?: string }>>
}

/** One installed module with its active context, as `automations_data` answers it. */
export interface InstallationRow {
    readonly module_key: string
    readonly operating_mode: string | null
    readonly ctx: { readonly id: string; readonly version: number; readonly snapshot: ContextSnapshotRow } | null
}

/** One pipeline row. */
export interface PipelineRow {
    readonly id: string
    readonly workspace_id: string
    readonly template_key: string
    readonly name: string
    readonly module_key: string | null
    readonly enabled: boolean
    readonly dismissed: boolean
    readonly config: Readonly<Record<string, unknown>>
    readonly body: string | null
    readonly body_version: number
    readonly template_version: number
    readonly based_on_context: number | null
    readonly approval_streak: number
    readonly trust_offered_at: string | null
    readonly auto_send: boolean
    readonly created_at: string
    readonly updated_at: string
}

/** One step of a run. */
export interface RunStepRow {
    readonly label: string
    readonly status: "done" | "skipped" | "waiting" | "failed"
    readonly detail?: string
    readonly workItemId?: string
    readonly message?: string
}

/** One run row of the history. */
export interface RunRow {
    readonly id: string
    readonly pipeline_id: string
    readonly trigger_ref: string
    readonly status: "queued" | "running" | "done" | "skipped" | "waiting_approval" | "failed"
    readonly steps: ReadonlyArray<RunStepRow> | null
    readonly evidence: string | null
    readonly error: string | null
    readonly created_at: string
    readonly finished_at: string | null
}

/** One rule of the owner's authority. */
export interface RuleRow {
    readonly department: string
    readonly action: string
    readonly mode: "auto" | "ask" | "never"
}

/** The Google connection, if any. */
export interface GoogleRow {
    readonly status: string
    readonly last_error: string | null
    readonly public_meta: Readonly<Record<string, string>> | null
}

/** Every row the screen reads, in one call (`automations_data`). */
export interface OverviewRows {
    readonly installations: ReadonlyArray<InstallationRow>
    readonly pipelines: ReadonlyArray<PipelineRow>
    readonly runs: ReadonlyArray<RunRow>
    readonly google: GoogleRow | null
    readonly knowledge: ReadonlyArray<{ readonly title: string; readonly content: string }>
    readonly due_invoices: number
    readonly connections: ReadonlyArray<{ readonly provider: string; readonly status: string }>
    readonly chat_agents: number
    readonly workspace_name: string | null
    readonly authority: { readonly reply_style?: string; readonly brand_voice?: string } | null
    readonly rules: ReadonlyArray<RuleRow>
    readonly contracts: number
    readonly shipped_orders: number
}
