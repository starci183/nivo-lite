import type { ModuleFixtures } from "../../../shared/modules/module-fixtures"
import type { CandidateRow, CandidateView, JobRow, JobView } from "../hiring-records"

const JOB: JobView = {
    id: "8f1c2b9e-0d6a-4c41-9a37-2b1f5e6d7a01",
    title: "Nh\u00e2n vi\u00ean pha ch\u1ebf",
    description: "Pha ch\u1ebf \u0111\u1ed3 u\u1ed1ng t\u1ea1i qu\u1ea7y, ca s\u00e1ng ho\u1eb7c ca chi\u1ec1u.",
    requirements: "\u00cdt nh\u1ea5t 1 n\u0103m pha ch\u1ebf; l\u00e0m \u0111\u01b0\u1ee3c cu\u1ed1i tu\u1ea7n; giao ti\u1ebfp t\u1ed1t v\u1edbi kh\u00e1ch.",
    status: "open",
    createdAt: "2026-11-10T02:00:00.000Z",
}

const CANDIDATE: CandidateView = {
    id: "3a7d9c10-5e2b-4f88-b1c6-9d0e4f2a8b02",
    name: "Tr\u1ea7n Minh Anh",
    contact: "minhanh@example.com",
    jobId: JOB.id,
    jobTitle: JOB.title,
    stage: "screened",
    profile: "2 n\u0103m pha ch\u1ebf t\u1ea1i qu\u00e1n c\u00e0 ph\u00ea; c\u00f3 th\u1ec3 l\u00e0m th\u1ee9 B\u1ea3y, Ch\u1ee7 nh\u1eadt.",
    screeningSummary: "\u0110\u00e3 c\u00f3 2 n\u0103m pha ch\u1ebf, l\u00e0m \u0111\u01b0\u1ee3c cu\u1ed1i tu\u1ea7n. Ch\u01b0a r\u00f5 k\u1ef9 n\u0103ng giao ti\u1ebfp v\u1edbi kh\u00e1ch: c\u1ea7n h\u1ecfi th\u00eam.",
    notes: "",
    cvName: "cv-minh-anh.pdf",
    createdAt: "2026-11-12T03:00:00.000Z",
}

const NEW_CANDIDATE: CandidateView = {
    ...CANDIDATE,
    id: "5c2e8a41-7b9d-4e10-a3f6-1d8c0b7e9a03",
    name: "L\u00ea Ho\u00e0ng Nam",
    contact: "0901 234 567",
    stage: "new",
    profile: "",
    screeningSummary: "",
    cvName: "",
    createdAt: "2026-11-13T01:00:00.000Z",
}

/** A job as the jobs list draws it. */
const jobRowOf = ({ id, title, status, createdAt }: JobView): JobRow => ({ id, title, status, createdAt })

/** A candidate as the candidates list draws it. */
const candidateRowOf = ({ id, name, contact, jobId, stage, createdAt }: CandidateView): CandidateRow => ({
    id,
    name,
    contact,
    jobId,
    stage,
    createdAt,
})

/** A candidate record as the contact detail draws it: the row of the Hiring's own read, without the bookkeeping. */
const contactRowOf = ({ id, name, stage, screeningSummary }: CandidateView) => ({ id, name, stage, screeningSummary })

/** The Hiring reads in the states a prototype draws (ready and empty) and the answer of each action. */
export const HIRING_FIXTURES: ModuleFixtures = {
    reads: {
        "blocks-core.hiring.api.job.list": { ready: { rows: [jobRowOf(JOB)], cursor: null }, empty: { rows: [], cursor: null } },
        "blocks-core.hiring.api.job.get": { ready: JOB, empty: null },
        "blocks-core.hiring.api.candidate.of-contact": {
            ready: { rows: [contactRowOf(CANDIDATE)], cursor: null },
            empty: { rows: [], cursor: null },
        },
        "blocks-core.hiring.api.candidate.list": {
            ready: { rows: [candidateRowOf(NEW_CANDIDATE), candidateRowOf(CANDIDATE)], cursor: null },
            empty: { rows: [], cursor: null },
        },
        "blocks-core.hiring.api.candidate.get": { ready: CANDIDATE, empty: null },
    },
    actions: {
        "blocks-core.hiring.job-save": { ok: true, data: { id: JOB.id } },
        "blocks-core.hiring.candidate-add": { ok: true, data: { id: NEW_CANDIDATE.id } },
        "blocks-core.hiring.candidate-update": { ok: true, data: { id: CANDIDATE.id } },
    },
}
