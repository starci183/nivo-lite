import type {
    JobQuestionInput,
    JobRequirementsInput,
    MoveCandidateParams,
    RequestInterviewParams,
    SaveJobParams,
    SaveSettingsParams,
} from "./hiring-operations.contracts"
import type { ApplyParams, RespondSlotParams } from "./hiring-public.contracts"

/** A form as GraphQL hands it over: an optional field may arrive as null as well as absent. */
type GraphqlForm<T> = { readonly [K in keyof T]: undefined extends T[K] ? T[K] | null : T[K] }

/** True when GraphQL handed the field over: neither absent nor null. */
const isGiven = <V>(value: V | null | undefined): value is V => value !== undefined && value !== null

/** The stage move request of one workspace. */
interface MoveCandidateRequest extends MoveCandidateParams {
    /** The workspace the request acts in. */
    readonly workspaceId: string
}

/** The interview request of one workspace. */
interface RequestInterviewRequest extends RequestInterviewParams {
    /** The workspace the request acts in. */
    readonly workspaceId: string
}

/** The settings save request of one workspace. */
interface SaveSettingsRequest extends SaveSettingsParams {
    /** The workspace the request acts in. */
    readonly workspaceId: string
}

/** The job save request of one workspace. */
interface SaveJobRequest extends SaveJobParams {
    /** The workspace the request acts in. */
    readonly workspaceId: string
}

/** The job save form as GraphQL hands it over, with its nested requirements and questions. */
interface SaveJobForm extends Omit<GraphqlForm<SaveJobParams>, "requirements" | "questions"> {
    /** The requirements of the post, when given. */
    readonly requirements?: JobRequirementsInput | null
    /** The screening questions of the post. */
    readonly questions: ReadonlyArray<GraphqlForm<JobQuestionInput>>
}

/** Maps the stage move form to the request of the workspace it names; an absent reason stays absent. */
export const toMoveHiringCandidateRequest = (
    workspaceId: string,
    input: GraphqlForm<MoveCandidateParams>,
): MoveCandidateRequest => ({
    workspaceId,
    id: input.id,
    stage: input.stage,
    ...(isGiven(input.reason) ? { reason: input.reason } : {}),
})

/** Maps the interview form to the request of the workspace it names; an absent interviewer stays absent. */
export const toRequestHiringInterviewRequest = (
    workspaceId: string,
    input: GraphqlForm<RequestInterviewParams>,
): RequestInterviewRequest => ({
    workspaceId,
    candidateId: input.candidateId,
    ...(isGiven(input.interviewerUserId) ? { interviewerUserId: input.interviewerUserId } : {}),
    mode: input.mode,
    location: input.location,
    durationMin: input.durationMin,
})

/** Maps the settings form to the request of the workspace it names; only the fields given are saved. */
export const toSaveHiringSettingsRequest = (
    workspaceId: string,
    input: GraphqlForm<SaveSettingsParams>,
): SaveSettingsRequest => ({
    workspaceId,
    ...(isGiven(input.publicSlug) ? { publicSlug: input.publicSlug } : {}),
    ...(isGiven(input.retentionDays) ? { retentionDays: input.retentionDays } : {}),
    ...(isGiven(input.notifyNewCandidate) ? { notifyNewCandidate: input.notifyNewCandidate } : {}),
    ...(isGiven(input.remindInterview) ? { remindInterview: input.remindInterview } : {}),
    ...(isGiven(input.autoCloseWhenFilled) ? { autoCloseWhenFilled: input.autoCloseWhenFilled } : {}),
    ...(isGiven(input.applyConsentText) ? { applyConsentText: input.applyConsentText } : {}),
    ...(isGiven(input.adTone) ? { adTone: input.adTone } : {}),
})

/** Maps the requirements of a post; an absent experience becomes null. */
const toJobRequirements = (input: JobRequirementsInput): JobRequirementsInput => ({
    skills: input.skills,
    experienceYears: input.experienceYears ?? null,
    experienceNote: input.experienceNote,
    availability: input.availability,
    mustHave: input.mustHave,
    niceToHave: input.niceToHave,
})

/** Maps one screening question; an absent field stays absent. */
const toJobQuestion = (input: GraphqlForm<JobQuestionInput>): JobQuestionInput => ({
    ...(isGiven(input.id) ? { id: input.id } : {}),
    text: input.text,
    type: input.type,
    required: input.required,
    ...(isGiven(input.choices) ? { choices: input.choices } : {}),
    ...(isGiven(input.expectYesNo) ? { expectYesNo: input.expectYesNo } : {}),
    ...(isGiven(input.expectNumber) ? { expectNumber: input.expectNumber } : {}),
    ...(isGiven(input.expectChoices) ? { expectChoices: input.expectChoices } : {}),
})

/** Maps the job form to the save request of the workspace it names; an absent field stays absent. */
export const toSaveHiringJobRequest = (workspaceId: string, input: SaveJobForm): SaveJobRequest => ({
    workspaceId,
    ...(isGiven(input.id) ? { id: input.id } : {}),
    title: input.title,
    ...(isGiven(input.position) ? { position: input.position } : {}),
    ...(isGiven(input.employmentType) ? { employmentType: input.employmentType } : {}),
    ...(isGiven(input.schedule) ? { schedule: input.schedule } : {}),
    ...(isGiven(input.payMinVnd) ? { payMinVnd: input.payMinVnd } : {}),
    ...(isGiven(input.payMaxVnd) ? { payMaxVnd: input.payMaxVnd } : {}),
    ...(isGiven(input.payUnit) ? { payUnit: input.payUnit } : {}),
    ...(isGiven(input.location) ? { location: input.location } : {}),
    ...(isGiven(input.headcount) ? { headcount: input.headcount } : {}),
    ...(isGiven(input.description) ? { description: input.description } : {}),
    ...(isGiven(input.requirements) ? { requirements: toJobRequirements(input.requirements) } : {}),
    questions: input.questions.map(toJobQuestion),
    ...(isGiven(input.channels) ? { channels: input.channels } : {}),
    ...(isGiven(input.closesAt) ? { closesAt: input.closesAt } : {}),
})

/** Maps the public application form; an absent CV or website stays absent. */
export const toApplyToHiringJobRequest = (input: GraphqlForm<ApplyParams>): ApplyParams => ({
    ws: input.ws,
    job: input.job,
    name: input.name,
    phone: input.phone,
    email: input.email,
    availability: input.availability,
    consent: input.consent,
    answers: input.answers,
    ...(isGiven(input.cvPath) ? { cvPath: input.cvPath } : {}),
    ...(isGiven(input.cvName) ? { cvName: input.cvName } : {}),
    ...(isGiven(input.website) ? { website: input.website } : {}),
})

/** Maps the interview answer of a candidate; an absent slot stays absent. */
export const toRespondHiringInterviewRequest = (input: GraphqlForm<RespondSlotParams>): RespondSlotParams => ({
    token: input.token,
    ...(isGiven(input.start) ? { start: input.start } : {}),
})
