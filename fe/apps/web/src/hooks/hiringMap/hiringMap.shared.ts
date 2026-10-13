import type {
    HiringBenchType,
    HiringCandidateDetailType,
    HiringCandidateType,
    HiringInterviewType,
    HiringJobQuestionType,
    HiringJobRequirementsType,
    HiringJobType,
    HiringMemberType,
    HiringOfferType,
} from "@/modules/api"
import type {
    AdView,
    CandidateDetailView,
    CandidateView,
    HiringMemberView,
    HiringWorkbenchData,
    InterviewView,
    JobQuestionView,
    JobView,
    OfferView,
    RequirementsView,
} from "@/hooks/hiringWire"

const textOf = (source: unknown, key: string): string => {
    const value: unknown = typeof source === "object" && source !== null ? Reflect.get(source, key) : undefined
    return typeof value === "string" ? value : ""
}

const requirementsOf = (wire: HiringJobRequirementsType): RequirementsView => ({
    skills: wire.skills,
    experienceYears: wire.experienceYears ?? null,
    experienceNote: wire.experienceNote,
    availability: wire.availability,
    mustHave: wire.mustHave,
    niceToHave: wire.niceToHave,
})

const questionOf = (wire: HiringJobQuestionType): JobQuestionView => ({
    id: wire.id,
    text: wire.text,
    type: wire.type,
    required: wire.required,
    choices: wire.choices,
    expectYesNo: wire.expectYesNo ?? null,
    expectNumber: wire.expectNumber ?? null,
    expectChoices: wire.expectChoices ?? [],
})

const adOf = (wire: unknown): AdView | null => {
    const ad = { facebook: textOf(wire, "facebook"), zalo: textOf(wire, "zalo"), topcv: textOf(wire, "topcv") }
    return ad.facebook === "" && ad.zalo === "" && ad.topcv === "" ? null : ad
}

const jobOf = (wire: HiringJobType): JobView => ({
    id: wire.id,
    title: wire.title,
    position: wire.position,
    employmentType: wire.employmentType,
    schedule: wire.schedule,
    payMinVnd: wire.payMinVnd ?? null,
    payMaxVnd: wire.payMaxVnd ?? null,
    payUnit: wire.payUnit,
    location: wire.location,
    headcount: wire.headcount,
    description: wire.description,
    requirements: requirementsOf(wire.requirements),
    questions: wire.questions.map(questionOf),
    status: wire.status,
    channels: wire.channels,
    ad: adOf(wire.adVariants),
    publicUrl: wire.publicUrl ?? null,
})

const candidateOf = (wire: HiringCandidateType): CandidateView => ({
    id: wire.id,
    jobId: wire.jobId,
    name: wire.name,
    phone: wire.phone,
    email: wire.email,
    source: wire.source,
    cvPath: wire.cvPath ?? null,
    answers: wire.answers,
    availability: wire.availability,
    score: wire.score ?? null,
    scoreLabel: wire.scoreLabel ?? null,
    scoreReasons: wire.scoreReasons,
    scoreSummary: wire.scoreSummary ?? null,
    stage: wire.stage,
    notes: wire.notes,
    staffId: wire.staffId ?? null,
    createdAt: wire.createdAt,
})

const interviewOf = (wire: HiringInterviewType): InterviewView => ({
    id: wire.id,
    candidateId: wire.candidateId,
    jobId: wire.jobId,
    interviewerName: wire.interviewerName,
    mode: wire.mode,
    location: wire.location,
    slots: wire.proposedSlots,
    slotStart: wire.slotStart ?? null,
    status: wire.status,
    token: wire.token,
    note: wire.note,
    workItemId: wire.workItemId ?? null,
})

const offerOf = (wire: HiringOfferType): OfferView => ({
    id: wire.id,
    candidateId: wire.candidateId,
    jobId: wire.jobId,
    pay: wire.terms.pay,
    startDate: wire.terms.startDate,
    status: wire.status,
    token: wire.token,
    sentAt: wire.sentAt ?? null,
    sentVia: wire.sentVia ?? null,
    expiresAt: wire.expiresAt ?? null,
    workItemId: wire.workItemId ?? null,
})

const memberOf = (wire: HiringMemberType): HiringMemberView => ({
    userId: wire.userId,
    name: wire.name,
    windows: wire.windows,
})

/** Maps the `hiringWorkbench` answer to the flat views the screens draw. */
export const toHiringWorkbenchData = (wire: HiringBenchType): HiringWorkbenchData => ({
    nowIso: wire.nowIso,
    origin: wire.origin,
    meUserId: wire.meUserId,
    waitingApprovals: wire.waitingApprovals,
    settings: wire.settings,
    figures: wire.figures,
    jobs: wire.jobs.map(jobOf),
    candidates: wire.candidates.map(candidateOf),
    interviews: wire.interviews.map(interviewOf),
    offers: wire.offers.map(offerOf),
    onboarding: wire.onboarding,
    members: wire.members.map(memberOf),
})

/** The candidate detail with its timeline flattened. */
export const toCandidateDetail = (wire: HiringCandidateDetailType): CandidateDetailView => ({
    cv: wire.cv ?? null,
    events: wire.events,
})
