import type {
    Answer,
    ApplicationSource,
    CandidateRecord,
    InterviewRecord,
    InterviewStatus,
    OfferRecord,
    OfferStatus,
    OfferTerms,
    Slot,
} from "../hiring.contracts"
import type {
    HiringCandidateAnswer,
    HiringCandidateEntity,
    HiringInterviewEntity,
    HiringInterviewSlot,
    HiringOfferEntity,
    HiringOfferTerms,
} from "../persistence/entities"
import { isStage, pick } from "./row-mappers.policy"
import { isoOrNull } from "./vn-time.policy"

const SOURCES: ReadonlyArray<ApplicationSource> = ["page", "chat", "manual"]
const INTERVIEW_STATUSES: ReadonlyArray<InterviewStatus> = ["proposed", "confirmed", "done", "cancelled", "no_show"]
const OFFER_STATUSES: ReadonlyArray<OfferStatus> = [
    "draft",
    "waiting",
    "sent",
    "accepted",
    "declined",
    "expired",
    "cancelled",
]

const toAnswer = (json: HiringCandidateAnswer): Answer => ({
    questionId: json.question_id,
    question: json.question,
    answer: json.answer,
})

/** A candidate. */
export const toCandidate = (row: HiringCandidateEntity): CandidateRecord => ({
    id: row.id,
    workspaceId: row.workspaceId,
    jobId: row.jobId,
    name: row.name,
    phone: row.phone,
    email: row.email,
    source: pick(SOURCES, row.source, "page"),
    conversationId: row.conversationId,
    cvPath: row.cvPath,
    cvName: row.cvName,
    cvMime: row.cvMime,
    answers: (row.answers ?? []).map(toAnswer),
    availability: row.availability,
    stage: isStage(row.stage) ? row.stage : "applied",
    staffId: row.staffId,
})

const toSlot = (json: HiringInterviewSlot): Slot => ({ start: json.start, end: json.end })

/** An interview. */
export const toInterview = (row: HiringInterviewEntity): InterviewRecord => ({
    id: row.id,
    workspaceId: row.workspaceId,
    candidateId: row.candidateId,
    jobId: row.jobId,
    interviewerUserId: row.interviewerUserId,
    interviewerName: row.interviewerName,
    mode: row.mode === "online" ? "online" : "in_person",
    location: row.location,
    durationMin: row.durationMin,
    proposedSlots: (row.proposedSlots ?? []).map(toSlot),
    slotStart: isoOrNull(row.slotStart),
    slotEnd: isoOrNull(row.slotEnd),
    status: pick(INTERVIEW_STATUSES, row.status, "proposed"),
    token: row.token,
    workItemId: row.workItemId,
    note: row.note,
})

const toTerms = (json: HiringOfferTerms | null): OfferTerms => ({
    title: json?.title ?? "",
    pay: json?.pay ?? "",
    startDate: json?.start_date ?? "",
    probation: json?.probation ?? "",
    note: json?.note ?? "",
})

/** The terms as the column stores them. */
export const termsJson = (terms: OfferTerms): HiringOfferTerms => ({
    title: terms.title,
    pay: terms.pay,
    start_date: terms.startDate,
    probation: terms.probation,
    note: terms.note,
})

/** An offer. */
export const toOffer = (row: HiringOfferEntity): OfferRecord => ({
    id: row.id,
    workspaceId: row.workspaceId,
    candidateId: row.candidateId,
    jobId: row.jobId,
    terms: toTerms(row.terms),
    draft: row.draft,
    status: pick(OFFER_STATUSES, row.status, "draft"),
    token: row.token,
    workItemId: row.workItemId,
    expiresAt: isoOrNull(row.expiresAt),
})
