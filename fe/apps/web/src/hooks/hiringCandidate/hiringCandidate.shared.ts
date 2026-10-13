import type { JobView, HiringMemberView } from "@/hooks/hiringWire"

/** How an interview is held. */
export const INTERVIEW_MODES: ReadonlyArray<string> = ["in_person", "online"]

/** The dialogs the candidate drawer opens. */
export type CandidateDialog = "interview" | "offer" | "reject" | "delete"

/** What a request for an interview or an offer came to. */
export interface RequestOutcomeView {
    readonly status: string
    readonly summary: string
}

/** The values of the interview request form. */
export interface InterviewValues {
    interviewerUserId: string
    mode: string
    location: string
    durationMin: number
}

/** The values of the offer request form. */
export interface OfferValues {
    title: string
    pay: string
    startDate: string
    probation: string
    note: string
}

/** The interview form of a candidate: the caller interviews unless nobody is known, at the job's place, for half an hour. */
export const interviewDefaults = (
    job: JobView | undefined,
    members: ReadonlyArray<HiringMemberView>,
    meUserId: string,
): InterviewValues => ({
    interviewerUserId: members.find((member) => member.userId === meUserId)?.userId ?? members[0]?.userId ?? "",
    mode: "in_person",
    location: job?.location ?? "",
    durationMin: 30,
})

/** The offer form of a candidate: the job's title and pay. */
export const offerDefaults = (job: JobView | undefined, pay: string): OfferValues => ({
    title: job?.title ?? "",
    pay,
    startDate: "",
    probation: "",
    note: "",
})

/** Whether the CV can be previewed in the page: a PDF or an image. */
export const isPreviewable = (mime: string): boolean => mime === "application/pdf" || mime.startsWith("image/")
