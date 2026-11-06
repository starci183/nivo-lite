import type { PipelineRow } from "@modules/domain/automation-pipelines"

/** A pipeline row; a spec overrides the few fields it reads. */
export const buildPipelineRow = (overrides: Partial<PipelineRow> = {}): PipelineRow => ({
    id: "p-1",
    workspace_id: "ws-1",
    template_key: "thank_payment",
    name: "Thank",
    module_key: "sales",
    enabled: true,
    dismissed: false,
    config: {},
    body: null,
    body_version: 0,
    template_version: 1,
    based_on_context: null,
    approval_streak: 0,
    trust_offered_at: null,
    auto_send: false,
    created_at: "2026-10-01T00:00:00.000Z",
    updated_at: "2026-10-01T00:00:00.000Z",
    ...overrides,
})
