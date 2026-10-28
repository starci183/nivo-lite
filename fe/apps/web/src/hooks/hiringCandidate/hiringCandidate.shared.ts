import type { useTranslations } from "next-intl"
import { OPEN_OFFER_STATUSES, reasonTone, scoreTone, type useHiringFormat } from "@/hooks/hiring"
import type { CandidateView, JobView, HiringMemberView } from "@/hooks/hiringWire"
import type { useHiringCandidate } from "./useHiringCandidate"

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

/** Where the CV of a candidate stands. */
type CvState = "none" | "loading" | "ready"

/** Where the CV stands: there is none, the link is still loading, or it is ready. */
const cvStateOf = (hasFile: boolean, isLoaded: boolean, hasLink: boolean): CvState => {
    if (hasLink) return "ready"
    return hasFile && !isLoaded ? "loading" : "none"
}

/** The screening, CV and activity already resolved for the candidate. */
export const candidateDetailsOf = (
    candidate: CandidateView,
    view: ReturnType<typeof useHiringCandidate>,
    format: ReturnType<typeof useHiringFormat>,
    t: ReturnType<typeof useTranslations<"hiring">>,
) => {
    const cv = view.detail?.cv ?? null
    return {
        score:
            candidate.score === null
                ? null
                : {
                      value: t("pipeScore", { score: candidate.score }),
                      label: candidate.scoreLabel === null ? "" : t(`score_${candidate.scoreLabel}`),
                      tone: scoreTone(candidate.scoreLabel),
                      summary: candidate.scoreSummary,
                      reasons: candidate.scoreReasons.map((reason, index) => ({
                          id: `${index}:${reason.criterion}`,
                          criterion: reason.criterion,
                          note: reason.note,
                          statusLabel: format.label("reason", reason.status),
                          tone: reasonTone(reason.status),
                      })),
                  },
        cv: {
            state: cvStateOf(candidate.cvPath !== null, view.detail !== undefined, cv !== null),
            openLabel: cv === null ? "" : t("candCvOpen", { name: cv.name }),
            url: cv?.url ?? "",
            isPdf: cv?.mime === "application/pdf",
            canPreview: cv !== null && isPreviewable(cv.mime),
            isPreviewing: view.showCv,
        },
        answers: candidate.answers.map((answer) => ({
            id: answer.questionId,
            title: answer.question,
            text: answer.answer,
        })),
        interviews: view.interviews.map((entry) => ({
            id: entry.id,
            title: "",
            text: [
                format.label("ivStatus", entry.status) +
                    (entry.slotStart === null ? "" : `: ${format.dateTime(entry.slotStart)}`),
                entry.interviewerName,
            ]
                .filter((part) => part !== "")
                .join(" · "),
        })),
        offers: view.offers.map((entry) => ({
            id: entry.id,
            title: "",
            text: `${format.label("offerStatus", entry.status)} · ${entry.pay}`,
            canCancel: OPEN_OFFER_STATUSES.includes(entry.status),
        })),
        events: view.detail?.events.map((event) => ({
            id: event.id,
            title: event.summary,
            text: `${event.actor} · ${format.dateTime(event.createdAt)}`,
        })),
    }
}
