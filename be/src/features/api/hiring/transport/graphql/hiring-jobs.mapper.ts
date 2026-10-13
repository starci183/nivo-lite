import type { EnsureSettingsOutput, GenerateAdOutput, SaveJobOutput, SetJobStatusOutput } from "@modules/domain/hiring"
import type { GenerateHiringAdRequest } from "../../application/generate-hiring-ad.contracts"
import type { SetHiringJobStatusRequest } from "../../application/set-hiring-job-status.contracts"
import type { GenerateAdType } from "./dto/generate-ad.type"
import type { HiringJobRefInput } from "./dto/hiring-job-ref.input"
import type { HiringSettingsType } from "./dto/hiring-settings.type"
import type { HiringStatusType } from "./dto/hiring-status.type"
import type { SaveJobType } from "./dto/save-job.type"
import type { SetHiringJobStatusInput } from "./dto/set-hiring-job-status.input"

/** Maps the GraphQL input to the settings save request of the workspace it names. */
export { toSaveHiringSettingsRequest } from "@modules/domain/hiring"

/** Maps the GraphQL input to the job save request of the workspace it names. */
export { toSaveHiringJobRequest } from "@modules/domain/hiring"

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
