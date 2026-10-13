/** What the request to read a published job for the apply page takes. */
export interface PublicJobParams {
    /** The workspace slug. */
    readonly ws: string
    /** The job slug. */
    readonly job: string
}

/** The requirements shown to applicants. */
export interface PublicRequirements {
    /** Skills. */
    readonly skills: ReadonlyArray<string>
    /** Years of experience. */
    readonly experienceYears: number | null
    /** Experience note. */
    readonly experienceNote: string
    /** Availability. */
    readonly availability: ReadonlyArray<string>
    /** Must have. */
    readonly mustHave: ReadonlyArray<string>
    /** Nice to have. */
    readonly niceToHave: ReadonlyArray<string>
}

/** One question, without what it scores against. */
export interface PublicQuestion {
    /** The question id. */
    readonly id: string
    /** The question text. */
    readonly text: string
    /** The kind of answer. */
    readonly type: "text" | "yesno" | "number" | "choice"
    /** Whether an answer is required. */
    readonly required: boolean
    /** The offered choices. */
    readonly choices: ReadonlyArray<string>
}

/** What the request to read a published job for the apply page answers. */
export interface PublicJobOutput {
    /** The post title. */
    readonly title: string
    /** The position name. */
    readonly position: string
    /** How the job is worked. */
    readonly employmentType: "full_time" | "part_time"
    /** The work schedule. */
    readonly schedule: string
    /** The lowest pay. */
    readonly payMinVnd: number | null
    /** The highest pay. */
    readonly payMaxVnd: number | null
    /** The unit of the pay. */
    readonly payUnit: "month" | "hour" | "shift"
    /** The place of work. */
    readonly location: string
    /** How many people are wanted. */
    readonly headcount: number
    /** The description. */
    readonly description: string
    /** The status. */
    readonly status: string
    /** When applications stop. */
    readonly closesAt: string | null
    /** The business name. */
    readonly company: string
    /** The consent text. */
    readonly consentText: string
    /** Whether the job takes applications now. */
    readonly open: boolean
    /** The written requirements. */
    readonly requirements: PublicRequirements
    /** The questions. */
    readonly questions: ReadonlyArray<PublicQuestion>
}

/** What the request to get a signed place to upload a CV takes. */
export interface CreateCvUploadParams {
    /** The workspace slug. */
    readonly ws: string
    /** The job slug. */
    readonly job: string
    /** The file name. */
    readonly fileName: string
}

/** What the request to get a signed place to upload a CV answers. */
export interface CreateCvUploadOutput {
    /** The storage path to send with the application. */
    readonly path: string
    /** The upload token. */
    readonly token: string
}

/** One answer. */
export interface ApplyAnswer {
    /** The question id. */
    readonly questionId: string
    /** The answer. */
    readonly answer: string
}

/** What the request to apply for a job takes. */
export interface ApplyParams {
    /** The workspace slug. */
    readonly ws: string
    /** The job slug. */
    readonly job: string
    /** The applicant's name. */
    readonly name: string
    /** The phone. */
    readonly phone: string
    /** The email. */
    readonly email: string
    /** The days and hours they can work. */
    readonly availability: string
    /** Whether they agreed that the business stores the application. */
    readonly consent: boolean
    /** The answers. */
    readonly answers: ReadonlyArray<ApplyAnswer>
    /** The path returned by the upload. */
    readonly cvPath?: string
    /** The original file name. */
    readonly cvName?: string
    /** A field people leave empty; bots fill it. */
    readonly website?: string
}

/** What the request to apply for a job answers. */
export interface ApplyOutput {
    /** Whether the applicant had already applied for this job. */
    readonly duplicate: boolean
}

/** What the request to read an interview from the candidate's link takes. */
export interface PublicInterviewParams {
    /** The link token. */
    readonly token: string
}

/** One offered time. */
export interface PublicSlot {
    /** The start, ISO. */
    readonly start: string
    /** The end, ISO. */
    readonly end: string
}

/** What the request to read an interview from the candidate's link answers. */
export interface PublicInterviewOutput {
    /** The interview status. */
    readonly status: string
    /** The candidate. */
    readonly candidateName: string
    /** The job. */
    readonly jobTitle: string
    /** The business. */
    readonly shop: string
    /** In person or online. */
    readonly mode: "in_person" | "online"
    /** The address or link. */
    readonly location: string
    /** The length in minutes. */
    readonly durationMin: number
    /** The interviewer. */
    readonly interviewerName: string
    /** The confirmed time. */
    readonly slotStart: string | null
    /** The candidate's note. */
    readonly note: string
    /** The offered times. */
    readonly proposedSlots: ReadonlyArray<PublicSlot>
}

/** What the request to read an offer from the candidate's link takes. */
export interface PublicOfferParams {
    /** The link token. */
    readonly token: string
}

/** The terms of an offer. */
export interface PublicTerms {
    /** The position. */
    readonly title: string
    /** The pay. */
    readonly pay: string
    /** The start date. */
    readonly startDate: string
    /** The probation. */
    readonly probation: string
    /** A free note. */
    readonly note: string
}

/** What the request to read an offer from the candidate's link answers. */
export interface PublicOfferOutput {
    /** The offer status. */
    readonly status: string
    /** The candidate. */
    readonly candidateName: string
    /** The job. */
    readonly jobTitle: string
    /** The place of work. */
    readonly location: string
    /** The business. */
    readonly shop: string
    /** The letter text. */
    readonly letter: string
    /** When the offer lapses. */
    readonly expiresAt: string | null
    /** The terms. */
    readonly terms: PublicTerms
}

/** What the request to pick an interview time from the candidate's link takes. */
export interface RespondSlotParams {
    /** The link token. */
    readonly token: string
    /** The chosen start, ISO; absent says no time fits. */
    readonly start?: string
}

/** What the request to pick an interview time from the candidate's link answers. */
export interface RespondSlotOutput {
    /** What came of it. */
    readonly outcome: "confirmed" | "already_confirmed" | "none_fit" | "invalid" | "closed" | "not_offered" | "stale"
    /** The confirmed time. */
    readonly slotStart: string | null
}

/** What the request to accept or decline an offer from the candidate's link takes. */
export interface RespondOfferParams {
    /** The link token. */
    readonly token: string
    /** Whether the candidate accepts. */
    readonly accept: boolean
}

/** What the request to accept or decline an offer from the candidate's link answers. */
export interface RespondOfferOutput {
    /** What came of it. */
    readonly outcome:
        "accepted" | "declined" | "already_accepted" | "already_declined" | "invalid" | "closed" | "expired" | "stale"
}
