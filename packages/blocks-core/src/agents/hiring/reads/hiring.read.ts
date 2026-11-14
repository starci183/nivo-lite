import { defineRead, type ListShape, type ReadDefinition } from "@nivo-lite/agent-sdk/block"
import { listRead, type ListReadDefinition } from "@nivo-lite/agent-sdk/module"
import { z } from "zod"
import { MAX_ID } from "../../../shared/bounds"
import { CANDIDATE_STAGES } from "../entities/candidate.entity"
import { JOB_STATUSES } from "../entities/job.entity"
import { HIRING_VIEW } from "../constants"
import { type CandidateView, type JobView, candidateViewOf, jobViewOf } from "../hiring-records"
import { CANDIDATES, JOBS, hiringCandidatesList, hiringJobsList } from "../ports"

const JOB_FIELDS: ReadonlyArray<keyof JobView> = ["id", "title", "description", "requirements", "status", "createdAt"]

const CANDIDATE_FIELDS: ReadonlyArray<keyof CandidateView> = [
    "id",
    "name",
    "contact",
    "jobId",
    "jobTitle",
    "stage",
    "profile",
    "screeningSummary",
    "notes",
    "cvName",
    "createdAt",
]

/** What the jobs list accepts: the status as a filter, newest first. */
const JOBS_LIST: ListShape = {
    filters: { status: { field: "status", op: "eq", of: JOB_STATUSES } },
    sort: { recent: [["createdAt", "desc"]] },
    page: { size: 30 },
    row: { id: "id", title: "title", badge: "status" },
}

/** What the candidates list accepts: a search over the name and the contact, the stage as a filter, newest first. */
const CANDIDATES_LIST: ListShape = {
    search: { fields: ["name", "contact"] },
    filters: { stage: { field: "stage", op: "eq", of: CANDIDATE_STAGES } },
    sort: { recent: [["createdAt", "desc"]] },
    page: { size: 30 },
    row: { id: "id", title: "name", description: "contact", badge: "stage" },
}

/** `blocks-core.hiring.api.job.list`: the jobs, newest first, narrowed by status. */
export const jobsRead: ListReadDefinition = listRead({
    id: "blocks-core.hiring.api.job.list",
    dataKind: "hiring-job",
    permission: HIRING_VIEW,
    fields: ["id", "title", "status", "createdAt"],
    list: JOBS_LIST,
    source: hiringJobsList,
})

/** `blocks-core.hiring.api.candidate.list`: the candidates, newest first, searched and narrowed by stage. */
export const candidatesRead: ListReadDefinition = listRead({
    id: "blocks-core.hiring.api.candidate.list",
    dataKind: "hiring-candidate",
    permission: HIRING_VIEW,
    fields: ["id", "name", "contact", "jobId", "stage", "createdAt"],
    list: CANDIDATES_LIST,
    source: hiringCandidatesList,
})

/** `blocks-core.hiring.api.job.get`: one job, which the job forms start from; null when there is none. */
export const jobRead: ReadDefinition = defineRead({
    id: "blocks-core.hiring.api.job.get",
    dataKind: "hiring-job",
    shape: "record",
    fields: JOB_FIELDS,
    paths: {},
    variables: z.object({ id: z.string().min(1).max(MAX_ID) }),
    permission: HIRING_VIEW,
    ports: { jobs: JOBS },
    run: async ({ jobs }, { id }): Promise<JobView | null> => {
        const found = await jobs.get(id)
        return found === null ? null : jobViewOf(found)
    },
})

/** `blocks-core.hiring.api.candidate.get`: one candidate with the title of their job; null when there is none. */
export const candidateRead: ReadDefinition = defineRead({
    id: "blocks-core.hiring.api.candidate.get",
    dataKind: "hiring-candidate",
    shape: "record",
    fields: CANDIDATE_FIELDS,
    paths: {},
    variables: z.object({ id: z.string().min(1).max(MAX_ID) }),
    permission: HIRING_VIEW,
    ports: { jobs: JOBS, candidates: CANDIDATES },
    run: async ({ jobs, candidates }, { id }): Promise<CandidateView | null> => {
        const found = await candidates.get(id)
        if (found === null) return null
        const jobId = found.data["jobId"]
        const job = typeof jobId === "string" ? await jobs.get(jobId) : null
        return candidateViewOf(found, job === null ? "" : jobViewOf(job).title)
    },
})
