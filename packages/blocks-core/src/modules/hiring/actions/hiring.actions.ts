import { defineAction, type ActionDefinition, type ActionResult } from "@nivo-lite/agent-sdk/block"
import type { EngineResult } from "@nivo-lite/agent-sdk/entity/port"
import { z } from "zod"
import { MAX_BODY, MAX_ID, MAX_LINE } from "../../../bounds"
import { CANDIDATE_STAGES } from "../../../entities/hiring/candidate.entity"
import { JOB_STATUSES } from "../../../entities/hiring/job.entity"
import { HIRING_MANAGE } from "../constants"
import { CANDIDATES, JOBS } from "../ports"

const JOB_READS = ["blocks-core.hiring.api.job.list", "blocks-core.hiring.api.job.get", "blocks-core.hiring.api.candidate.list"] as const
const CANDIDATE_READS = ["blocks-core.hiring.api.candidate.list", "blocks-core.hiring.api.candidate.get"] as const

/** A record the form names that the store does not hold. */
const MISSING: ActionResult = { ok: false, reason: "refused", message: { key: "refusal_missing" } }

/** A write another writer got to first, or one the engine refused: the person reloads and tries again. */
const CONFLICT: ActionResult = { ok: false, reason: "conflict", message: { key: "refusal_conflict" } }

/** The answer of a write: the record's id, or why nothing was written. */
const answerOf = (written: EngineResult): ActionResult => {
    if (written.ok) return { ok: true, data: { id: written.row.id } }
    return written.reason === "missing" ? MISSING : CONFLICT
}

/** `blocks-core.hiring.job-save`: creates a job, or changes the one the id names. */
export const saveJobAction: ActionDefinition = defineAction({
    id: "blocks-core.hiring.job-save",
    permission: HIRING_MANAGE,
    label: { key: "action_save_job" },
    input: z.object({
        id: z.string().max(MAX_ID).optional(),
        title: z.string().trim().min(1).max(MAX_LINE),
        description: z.string().max(MAX_BODY).optional(),
        requirements: z.string().max(MAX_BODY).optional(),
        status: z.enum(JOB_STATUSES).optional(),
    }),
    ports: { jobs: JOBS },
    transactional: true,
    run: async ({ jobs }, input) => {
        const values = {
            title: input.title,
            description: input.description ?? "",
            requirements: input.requirements ?? "",
            status: input.status ?? "open",
        }
        if (input.id === undefined || input.id === "") return answerOf(await jobs.insert(values))
        const current = await jobs.get(input.id)
        return current === null ? MISSING : answerOf(await jobs.update(current.id, current.version, values))
    },
    refreshes: JOB_READS,
    optimistic: false,
})

/** `blocks-core.hiring.candidate-add`: adds a candidate to the job the form stands on (`id`), at stage `new`. */
export const addCandidateAction: ActionDefinition = defineAction({
    id: "blocks-core.hiring.candidate-add",
    permission: HIRING_MANAGE,
    label: { key: "action_add_candidate" },
    input: z.object({
        id: z.string().min(1).max(MAX_ID),
        name: z.string().trim().min(1).max(MAX_LINE),
        contact: z.string().max(MAX_LINE).optional(),
        profile: z.string().max(MAX_BODY).optional(),
    }),
    ports: { jobs: JOBS, candidates: CANDIDATES },
    transactional: true,
    run: async ({ jobs, candidates }, input) => {
        const job = await jobs.get(input.id)
        if (job === null) return MISSING
        return answerOf(
            await candidates.insert({
                name: input.name,
                contact: input.contact ?? "",
                jobId: job.id,
                profile: input.profile ?? "",
                stage: "new",
            }),
        )
    },
    refreshes: CANDIDATE_READS,
    optimistic: false,
})

/** `blocks-core.hiring.candidate-update`: moves a candidate to a stage and keeps the team's notes. A person decides every stage. */
export const updateCandidateAction: ActionDefinition = defineAction({
    id: "blocks-core.hiring.candidate-update",
    permission: HIRING_MANAGE,
    label: { key: "action_update_candidate" },
    input: z.object({
        id: z.string().min(1).max(MAX_ID),
        stage: z.enum(CANDIDATE_STAGES),
        profile: z.string().max(MAX_BODY).optional(),
        notes: z.string().max(MAX_BODY).optional(),
    }),
    ports: { candidates: CANDIDATES },
    transactional: true,
    run: async ({ candidates }, input) => {
        const current = await candidates.get(input.id)
        if (current === null) return MISSING
        return answerOf(
            await candidates.update(current.id, current.version, {
                stage: input.stage,
                ...(input.profile === undefined ? {} : { profile: input.profile }),
                ...(input.notes === undefined ? {} : { notes: input.notes }),
            }),
        )
    },
    refreshes: CANDIDATE_READS,
    optimistic: false,
})
