import { DomainError } from "@modules/platform/errors"
import type { ErrorKind } from "@modules/platform/errors"

/** Codes of the hiring capability. */
export enum HiringErrorCode {
    /** The job title is shorter than 3 or longer than 140 characters. */
    JobTitleInvalid = "HIRING_JOB_TITLE_INVALID",
    /** The lowest pay is above the highest. */
    PayRangeInvalid = "HIRING_PAY_RANGE_INVALID",
    /** A text of the job, an answer or a note touches a protected trait; the sentence names where and what to write instead. */
    Unfair = "HIRING_UNFAIR",
    /** No job of the workspace has the requested id. */
    JobNotFound = "HIRING_JOB_NOT_FOUND",
    /** A job needs a description or some requirements before it opens. */
    JobNeedsContent = "HIRING_JOB_NEEDS_CONTENT",
    /** A unique public link for the job could not be made. */
    JobSlugUnavailable = "HIRING_JOB_SLUG_UNAVAILABLE",
    /** The public slug is shorter than 3 characters. */
    SlugInvalid = "HIRING_SLUG_INVALID",
    /** The public slug belongs to the app. */
    SlugReserved = "HIRING_SLUG_RESERVED",
    /** The public slug belongs to another workspace. */
    SlugTaken = "HIRING_SLUG_TAKEN",
    /** A public link for the workspace could not be made. */
    SettingsSlugUnavailable = "HIRING_SETTINGS_SLUG_UNAVAILABLE",
    /** The retention period is outside 7 to 730 days. */
    RetentionInvalid = "HIRING_RETENTION_INVALID",
    /** The consent text is outside 20 to 800 characters. */
    ConsentTextInvalid = "HIRING_CONSENT_TEXT_INVALID",
    /** The ad could not be written. */
    AdFailed = "HIRING_AD_FAILED",
    /** The job does not take applications now. */
    JobNotOpen = "HIRING_JOB_NOT_OPEN",
    /** The job passed its closing date. */
    JobExpired = "HIRING_JOB_EXPIRED",
    /** The applicant did not agree to the storing of the application. */
    ConsentRequired = "HIRING_CONSENT_REQUIRED",
    /** The name is shorter than 2 or longer than 120 characters. */
    NameInvalid = "HIRING_NAME_INVALID",
    /** The phone number cannot be a Vietnamese one. */
    PhoneInvalid = "HIRING_PHONE_INVALID",
    /** The email is not shaped like an address. */
    EmailInvalid = "HIRING_EMAIL_INVALID",
    /** Neither a phone nor an email was given. */
    ContactRequired = "HIRING_CONTACT_REQUIRED",
    /** A required question has no answer. */
    AnswerRequired = "HIRING_ANSWER_REQUIRED",
    /** No candidate of the workspace has the requested id. */
    CandidateNotFound = "HIRING_CANDIDATE_NOT_FOUND",
    /** The stage is not one of the pipeline. */
    StageInvalid = "HIRING_STAGE_INVALID",
    /** A candidate becomes hired by accepting the offer, not by hand. */
    StageHiredByOffer = "HIRING_STAGE_HIRED_BY_OFFER",
    /** The offer column is entered by writing the offer. */
    StageOfferByOffer = "HIRING_STAGE_OFFER_BY_OFFER",
    /** A rejection needs a reason. */
    RejectReasonRequired = "HIRING_REJECT_REASON_REQUIRED",
    /** The candidate is in a closed stage and cannot be invited or offered a job. */
    CandidateClosed = "HIRING_CANDIDATE_CLOSED",
    /** The candidate already has an open interview. */
    InterviewOpen = "HIRING_INTERVIEW_OPEN",
    /** The interviewer is not a member of the workspace. */
    InterviewerNotMember = "HIRING_INTERVIEWER_NOT_MEMBER",
    /** The workspace has nobody to interview. */
    InterviewerMissing = "HIRING_INTERVIEWER_MISSING",
    /** An online interview needs a meeting link. */
    OnlineLinkRequired = "HIRING_ONLINE_LINK_REQUIRED",
    /** The interviewer has no free time in the next 14 days. */
    NoSlots = "HIRING_NO_SLOTS",
    /** No interview of the workspace has the requested id. */
    InterviewNotFound = "HIRING_INTERVIEW_NOT_FOUND",
    /** The candidate already has an open offer. */
    OfferOpen = "HIRING_OFFER_OPEN",
    /** An offer needs the pay. */
    OfferPayRequired = "HIRING_OFFER_PAY_REQUIRED",
    /** No offer of the workspace has the requested id. */
    OfferNotFound = "HIRING_OFFER_NOT_FOUND",
    /** The offer can no longer be cancelled. */
    OfferNotCancellable = "HIRING_OFFER_NOT_CANCELLABLE",
    /** Only a hired candidate becomes a person in the shifts. */
    StaffNotHired = "HIRING_STAFF_NOT_HIRED",
    /** The candidate already is a person in the shifts. */
    StaffLinked = "HIRING_STAFF_LINKED",
    /** The availability windows are not valid. */
    AvailabilityInvalid = "HIRING_AVAILABILITY_INVALID",
    /** The person is not an active member of the workspace. */
    MemberNotFound = "HIRING_MEMBER_NOT_FOUND",
    /** No onboarding step of the workspace has the requested id. */
    OnboardingNotFound = "HIRING_ONBOARDING_NOT_FOUND",
    /** The public page or link does not exist or is no longer valid. */
    PublicNotFound = "HIRING_PUBLIC_NOT_FOUND",
}

/** How each hiring code travels. */
export const HIRING_ERROR_KINDS: Record<HiringErrorCode, ErrorKind> = {
    [HiringErrorCode.JobTitleInvalid]: "invalid",
    [HiringErrorCode.PayRangeInvalid]: "invalid",
    [HiringErrorCode.Unfair]: "invalid",
    [HiringErrorCode.JobNotFound]: "not-found",
    [HiringErrorCode.JobNeedsContent]: "invalid",
    [HiringErrorCode.JobSlugUnavailable]: "conflict",
    [HiringErrorCode.SlugInvalid]: "invalid",
    [HiringErrorCode.SlugReserved]: "invalid",
    [HiringErrorCode.SlugTaken]: "conflict",
    [HiringErrorCode.SettingsSlugUnavailable]: "conflict",
    [HiringErrorCode.RetentionInvalid]: "invalid",
    [HiringErrorCode.ConsentTextInvalid]: "invalid",
    [HiringErrorCode.AdFailed]: "internal",
    [HiringErrorCode.JobNotOpen]: "conflict",
    [HiringErrorCode.JobExpired]: "conflict",
    [HiringErrorCode.ConsentRequired]: "invalid",
    [HiringErrorCode.NameInvalid]: "invalid",
    [HiringErrorCode.PhoneInvalid]: "invalid",
    [HiringErrorCode.EmailInvalid]: "invalid",
    [HiringErrorCode.ContactRequired]: "invalid",
    [HiringErrorCode.AnswerRequired]: "invalid",
    [HiringErrorCode.CandidateNotFound]: "not-found",
    [HiringErrorCode.StageInvalid]: "invalid",
    [HiringErrorCode.StageHiredByOffer]: "conflict",
    [HiringErrorCode.StageOfferByOffer]: "conflict",
    [HiringErrorCode.RejectReasonRequired]: "invalid",
    [HiringErrorCode.CandidateClosed]: "conflict",
    [HiringErrorCode.InterviewOpen]: "conflict",
    [HiringErrorCode.InterviewerNotMember]: "invalid",
    [HiringErrorCode.InterviewerMissing]: "conflict",
    [HiringErrorCode.OnlineLinkRequired]: "invalid",
    [HiringErrorCode.NoSlots]: "conflict",
    [HiringErrorCode.InterviewNotFound]: "not-found",
    [HiringErrorCode.OfferOpen]: "conflict",
    [HiringErrorCode.OfferPayRequired]: "invalid",
    [HiringErrorCode.OfferNotFound]: "not-found",
    [HiringErrorCode.OfferNotCancellable]: "conflict",
    [HiringErrorCode.StaffNotHired]: "conflict",
    [HiringErrorCode.StaffLinked]: "conflict",
    [HiringErrorCode.AvailabilityInvalid]: "invalid",
    [HiringErrorCode.MemberNotFound]: "not-found",
    [HiringErrorCode.OnboardingNotFound]: "not-found",
    [HiringErrorCode.PublicNotFound]: "not-found",
}

/** The one error class of the hiring capability. */
export class HiringError extends DomainError<HiringErrorCode> {}
