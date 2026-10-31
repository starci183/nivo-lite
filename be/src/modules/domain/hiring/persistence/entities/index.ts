import { HiringAvailabilityEntity } from "./hiring-availability.entity"
import { HiringCandidateEntity } from "./hiring-candidate.entity"
import { HiringConsentEntity } from "./hiring-consent.entity"
import { HiringEventEntity } from "./hiring-event.entity"
import { HiringInterviewEntity } from "./hiring-interview.entity"
import { HiringJobEntity } from "./hiring-job.entity"
import { HiringOfferEntity } from "./hiring-offer.entity"
import { HiringOnboardingEntity } from "./hiring-onboarding.entity"
import { HiringRetentionLogEntity } from "./hiring-retention-log.entity"
import { HiringSettingEntity } from "./hiring-setting.entity"

export {
    HiringAvailabilityEntity,
    HiringCandidateEntity,
    HiringConsentEntity,
    HiringEventEntity,
    HiringInterviewEntity,
    HiringJobEntity,
    HiringOfferEntity,
    HiringOnboardingEntity,
    HiringRetentionLogEntity,
    HiringSettingEntity,
}
export type { HiringCandidateAnswer } from "./hiring-candidate.entity"
export type { HiringInterviewSlot } from "./hiring-interview.entity"
export type { HiringJobQuestion, HiringJobRequirements } from "./hiring-job.entity"
export type { HiringOfferTerms } from "./hiring-offer.entity"

/** The entities the hiring capability owns, collected by the database module. */
export const hiringEntities = [
    HiringAvailabilityEntity,
    HiringCandidateEntity,
    HiringConsentEntity,
    HiringEventEntity,
    HiringInterviewEntity,
    HiringJobEntity,
    HiringOfferEntity,
    HiringOnboardingEntity,
    HiringRetentionLogEntity,
    HiringSettingEntity,
] as const
