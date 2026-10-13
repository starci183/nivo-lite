import type { EnsureSettingsOutput, GenerateAdOutput, SaveJobOutput, SetJobStatusOutput } from "@modules/domain/hiring"
import type { GenerateHiringAdRequest } from "../../application/generate-hiring-ad.contracts"
import type { SaveHiringJobRequest } from "../../application/save-hiring-job.contracts"
import type { SaveHiringSettingsRequest } from "../../application/save-hiring-settings.contracts"
import type { SetHiringJobStatusRequest } from "../../application/set-hiring-job-status.contracts"
import type { GenerateAdType } from "./dto/generate-ad.type"
import type { HiringJobQuestionInput } from "./dto/hiring-job-question.input"
import type { HiringJobRefInput } from "./dto/hiring-job-ref.input"
import type { HiringJobRequirementsInput } from "./dto/hiring-job-requirements.input"
import type { HiringSettingsType } from "./dto/hiring-settings.type"
import type { HiringStatusType } from "./dto/hiring-status.type"
import type { SaveHiringJobInput } from "./dto/save-hiring-job.input"
import type { SaveHiringSettingsInput } from "./dto/save-hiring-settings.input"
import type { SaveJobType } from "./dto/save-job.type"
import type { SetHiringJobStatusInput } from "./dto/set-hiring-job-status.input"
import type { JobQuestionInput, JobRequirementsInput } from "@modules/domain/hiring"

/** Maps the GraphQL input to the settings save request of the workspace it names. */
export const toSaveHiringSettingsRequest = (
    workspaceId: string,
    input: SaveHiringSettingsInput,
): SaveHiringSettingsRequest => ({
    workspaceId,
    ...(input.publicSlug === undefined || input.publicSlug === null ? {} : { publicSlug: input.publicSlug }),
    ...(input.retentionDays === undefined || input.retentionDays === null
        ? {}
        : { retentionDays: input.retentionDays }),
    ...(input.notifyNewCandidate === undefined || input.notifyNewCandidate === null
        ? {}
        : { notifyNewCandidate: input.notifyNewCandidate }),
    ...(input.remindInterview === undefined || input.remindInterview === null
        ? {}
        : { remindInterview: input.remindInterview }),
    ...(input.autoCloseWhenFilled === undefined || input.autoCloseWhenFilled === null
        ? {}
        : { autoCloseWhenFilled: input.autoCloseWhenFilled }),
    ...(input.applyConsentText === undefined || input.applyConsentText === null
        ? {}
        : { applyConsentText: input.applyConsentText }),
    ...(input.adTone === undefined || input.adTone === null ? {} : { adTone: input.adTone }),
})

const toJobRequirements = (input: HiringJobRequirementsInput): JobRequirementsInput => ({
    skills: input.skills,
    experienceYears: input.experienceYears ?? null,
    experienceNote: input.experienceNote,
    availability: input.availability,
    mustHave: input.mustHave,
    niceToHave: input.niceToHave,
})

const toJobQuestion = (input: HiringJobQuestionInput): JobQuestionInput => ({
    ...(input.id === undefined || input.id === null ? {} : { id: input.id }),
    text: input.text,
    type: input.type,
    required: input.required,
    ...(input.choices === undefined || input.choices === null ? {} : { choices: input.choices }),
    ...(input.expectYesNo === undefined || input.expectYesNo === null ? {} : { expectYesNo: input.expectYesNo }),
    ...(input.expectNumber === undefined || input.expectNumber === null ? {} : { expectNumber: input.expectNumber }),
    ...(input.expectChoices === undefined || input.expectChoices === null
        ? {}
        : { expectChoices: input.expectChoices }),
})

/** Maps the GraphQL input to the job save request of the workspace it names. */
export const toSaveHiringJobRequest = (workspaceId: string, input: SaveHiringJobInput): SaveHiringJobRequest => ({
    workspaceId,
    ...(input.id === undefined || input.id === null ? {} : { id: input.id }),
    title: input.title,
    ...(input.position === undefined || input.position === null ? {} : { position: input.position }),
    ...(input.employmentType === undefined || input.employmentType === null
        ? {}
        : { employmentType: input.employmentType }),
    ...(input.schedule === undefined || input.schedule === null ? {} : { schedule: input.schedule }),
    ...(input.payMinVnd === undefined || input.payMinVnd === null ? {} : { payMinVnd: input.payMinVnd }),
    ...(input.payMaxVnd === undefined || input.payMaxVnd === null ? {} : { payMaxVnd: input.payMaxVnd }),
    ...(input.payUnit === undefined || input.payUnit === null ? {} : { payUnit: input.payUnit }),
    ...(input.location === undefined || input.location === null ? {} : { location: input.location }),
    ...(input.headcount === undefined || input.headcount === null ? {} : { headcount: input.headcount }),
    ...(input.description === undefined || input.description === null ? {} : { description: input.description }),
    ...(input.requirements === undefined || input.requirements === null
        ? {}
        : { requirements: toJobRequirements(input.requirements) }),
    questions: input.questions.map(toJobQuestion),
    ...(input.channels === undefined || input.channels === null ? {} : { channels: input.channels }),
    ...(input.closesAt === undefined || input.closesAt === null ? {} : { closesAt: input.closesAt }),
})

/** Maps the GraphQL input to the job status request of the workspace it names. */
export const toSetHiringJobStatusRequest = (
    workspaceId: string,
    input: SetHiringJobStatusInput,
): SetHiringJobStatusRequest => ({ workspaceId, ...input })

/** Maps the GraphQL input to the ad generation request of the workspace it names. */
export const toGenerateHiringAdRequest = (workspaceId: string, input: HiringJobRefInput): GenerateHiringAdRequest => ({
    workspaceId,
    jobId: input.jobId,
})

/** Maps the settings answer to the GraphQL type. */
export const toHiringSettingsType = (result: EnsureSettingsOutput, workspaceId: string): HiringSettingsType => ({
    workspaceId,
    publicSlug: result.publicSlug,
    retentionDays: result.retentionDays,
    notifyNewCandidate: result.notifyNewCandidate,
    remindInterview: result.remindInterview,
    autoCloseWhenFilled: result.autoCloseWhenFilled,
    applyConsentText: result.applyConsentText,
    adTone: result.adTone,
})

/** Maps the job save answer to the GraphQL type. */
export const toSaveJobType = (result: SaveJobOutput): SaveJobType => ({ id: result.id, slug: result.slug })

/** Maps the status answer to the GraphQL type. */
export const toHiringStatusType = (result: SetJobStatusOutput): HiringStatusType => ({ status: result.status })

/** Maps the generated ads to the GraphQL type. */
export const toGenerateAdType = (result: GenerateAdOutput): GenerateAdType => ({
    facebook: result.facebook,
    zalo: result.zalo,
    topcv: result.topcv,
    generatedAt: result.generatedAt,
    ms: result.ms,
    attempts: result.attempts,
    sanitised: result.sanitised,
})
