import type { RequirementsView } from "@/hooks/hiringWire"
import type {
    PublicInterviewType,
    PublicJobType,
    PublicOfferType,
    PublicQuestionType,
    PublicRequirementsType,
    PublicSlotType,
} from "@/modules/api"
import { supabaseUrl } from "@/modules/config"

/** The largest CV the apply form takes, in bytes. */
export const CV_MAX_BYTES = 5 * 1024 * 1024

/** The file types the CV field takes. */
export const CV_ACCEPT = ".pdf,.doc,.docx,.jpg,.jpeg,.png"

/** The private storage bucket CV files are kept in. */
const CV_BUCKET = "hiring"

/** One question of a public job. */
export interface PublicQuestionView {
    readonly id: string
    readonly text: string
    readonly type: string
    readonly required: boolean
    readonly choices: ReadonlyArray<string>
}

/** A job as the candidate sees it on the public page. */
export interface PublicJobView {
    readonly company: string
    readonly title: string
    readonly employmentType: string
    readonly payMinVnd: number | null
    readonly payMaxVnd: number | null
    readonly payUnit: string
    readonly location: string
    readonly schedule: string
    readonly description: string
    readonly open: boolean
    readonly consentText: string
    readonly requirements: RequirementsView
    readonly questions: ReadonlyArray<PublicQuestionView>
}

/** The job the apply form works with until the real one is read: no questions, no choices. */
export const NO_PUBLIC_JOB: PublicJobView = {
    company: "",
    title: "",
    employmentType: "",
    payMinVnd: null,
    payMaxVnd: null,
    payUnit: "",
    location: "",
    schedule: "",
    description: "",
    open: false,
    consentText: "",
    requirements: {
        skills: [],
        experienceYears: null,
        experienceNote: "",
        availability: [],
        mustHave: [],
        niceToHave: [],
    },
    questions: [],
}

/** An interview invitation as the candidate sees it on their own link. */
export interface PublicInterviewView {
    readonly shop: string
    readonly candidateName: string
    readonly jobTitle: string
    readonly mode: string
    readonly location: string
    readonly durationMin: number
    readonly interviewerName: string
    readonly status: string
    readonly slotStart: string | null
    readonly slots: ReadonlyArray<PublicSlotType>
}

/** A job offer as the candidate sees it on their own link. */
export interface PublicOfferView {
    readonly shop: string
    readonly candidateName: string
    readonly title: string
    readonly letter: string
    readonly expiresAt: string | null
    readonly status: string
    /** The letter is still open to an answer. */
    readonly isOpen: boolean
}

const requirementsOf = (wire: PublicRequirementsType): RequirementsView => ({
    skills: wire.skills,
    experienceYears: wire.experienceYears ?? null,
    experienceNote: wire.experienceNote,
    availability: wire.availability,
    mustHave: wire.mustHave,
    niceToHave: wire.niceToHave,
})

const questionOf = (wire: PublicQuestionType): PublicQuestionView => ({
    id: wire.id,
    text: wire.text,
    type: wire.type,
    required: wire.required,
    choices: wire.choices,
})

/** The public job with its lists flattened. */
export const toPublicJob = (wire: PublicJobType): PublicJobView => ({
    company: wire.company,
    title: wire.title,
    employmentType: wire.employmentType,
    payMinVnd: wire.payMinVnd ?? null,
    payMaxVnd: wire.payMaxVnd ?? null,
    payUnit: wire.payUnit,
    location: wire.location,
    schedule: wire.schedule,
    description: wire.description,
    open: wire.open,
    consentText: wire.consentText,
    requirements: requirementsOf(wire.requirements),
    questions: wire.questions.map(questionOf),
})

/** The public interview with its times flattened. */
export const toPublicInterview = (wire: PublicInterviewType): PublicInterviewView => ({
    shop: wire.shop,
    candidateName: wire.candidateName,
    jobTitle: wire.jobTitle,
    mode: wire.mode,
    location: wire.location,
    durationMin: wire.durationMin,
    interviewerName: wire.interviewerName,
    status: wire.status,
    slotStart: wire.slotStart ?? null,
    slots: wire.proposedSlots,
})

/** The public offer; an offer sent but past its date counts as expired. */
export const toPublicOffer = (wire: PublicOfferType): PublicOfferView => ({
    shop: wire.shop,
    candidateName: wire.candidateName,
    title: wire.terms.title === "" ? wire.jobTitle : wire.terms.title,
    letter: wire.letter,
    expiresAt: wire.expiresAt ?? null,
    status: wire.status,
    isOpen:
        wire.status === "sent" &&
        (wire.expiresAt === null || wire.expiresAt === undefined || Date.parse(wire.expiresAt) >= Date.now()),
})

/** The address a CV is PUT to: the presigned URL the back end hands out, or the signed-upload address built from its token. */
export const cvUploadUrl = (path: string, token: string): string =>
    token.startsWith("http")
        ? token
        : `${supabaseUrl()}/storage/v1/object/upload/sign/${CV_BUCKET}/${path}?token=${token}`

/** The values of the apply form. */
export interface ApplyValues {
    name: string
    phone: string
    email: string
    availability: Array<string>
    availabilityText: string
    answers: Record<string, string>
    consent: boolean
    website: string
}

/** The empty apply form. */
export const applyDefaults = (): ApplyValues => ({
    name: "",
    phone: "",
    email: "",
    availability: [],
    availabilityText: "",
    answers: {},
    consent: false,
    website: "",
})

/** The availability text sent: the ticked choices when the job lists some, else what the candidate wrote. */
export const availabilityOf = (values: ApplyValues, job: PublicJobView): string =>
    job.requirements.availability.length > 0 ? values.availability.join(", ") : values.availabilityText

/** The answers sent, one per question of the job. */
export const answerGroups = (values: ApplyValues, job: PublicJobView) =>
    job.questions.map((question) => ({ questionId: question.id, answer: values.answers[question.id] ?? "" }))
