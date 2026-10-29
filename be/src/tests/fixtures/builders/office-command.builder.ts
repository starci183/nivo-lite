import { builder, mock } from "@starci/jest-preset"
import type { ProposedCommand } from "@modules/domain/ai-tasks"
import type { CommandResult, WorkItem } from "@modules/domain/decisions"
import type { CandidateView } from "@modules/domain/office-command-candidates"

/** A command candidate as the candidate statements return it. */
export const candidateOf = builder<CandidateView>({
    id: "c-1",
    message_id: "m-1",
    module: "accounting",
    command: "issue_receipt",
    payload: { subject_type: "order", subject_id: "o-1", lead_id: "l-1" },
    summary: "issue a receipt for #DH-1",
    shown: [],
    status: "pending",
    work_item_id: null,
    refusal_detail: null,
    created_at: "2026-10-12T10:00:00+00:00",
})

/** What the model picked for a message. */
export const choiceOf = builder<ProposedCommand>({
    intent: "command",
    command: "issue_receipt",
    subject_id: "o-1",
    lead_id: null,
    fields: {},
})

/** The command bus accepting a command. */
export const sentOk = (created: boolean): CommandResult => ({
    ok: true,
    item: mock<WorkItem>({ id: "w-1" }),
    created,
    chainId: null,
    depth: 0,
})
