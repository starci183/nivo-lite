"use client"

import { useTranslations } from "next-intl"
import {
    OPEN_OFFER_STATUSES,
    focusedCandidateId,
    reasonTone,
    scoreTone,
    stageTone,
    useHiringFormat,
    useHiringSay,
    useHiringWorkbench,
} from "@/hooks/hiring"
import {
    INTERVIEW_MODES,
    interviewDefaults,
    isPreviewable,
    offerDefaults,
    useHiringCandidate,
    useHiringInterviewRequest,
    useHiringOfferRequest,
} from "@/hooks/hiringCandidate"
import { useHiringReject } from "@/hooks/hiringPipeline"
import { NO_CANDIDATE } from "@/hooks/hiringMap"
import { useHiringBenchStore } from "@/hooks/zustand/hiringBench"
import { useHiringInterviewForm, useHiringOfferForm } from "@/hooks/rhf"
import { HiringCandidateBase } from "./component"
import type { HiringCandidateBaseProps } from "./component"

/** The record a `?focus=` link leads to: the drawer opens on it until somebody opens another candidate or closes it. */
interface HiringCandidateProps {
    readonly focus: string | null
}

type CvState = HiringCandidateBaseProps["props"]["cv"]["state"]

/** Where the CV stands: there is none, the link is still loading, or it is ready. */
const cvStateOf = (hasFile: boolean, isLoaded: boolean, hasLink: boolean): CvState => {
    if (hasLink) return "ready"
    return hasFile && !isLoaded ? "loading" : "none"
}

/** The connected candidate drawer: the workbench row plus the detail query (CV link, timeline), and every command on the candidate. */
export const HiringCandidate = (props: HiringCandidateProps) => {
    const { board: data } = useHiringWorkbench()
    const { openId, close } = useHiringBenchStore()
    const wanted = openId === undefined ? focusedCandidateId(data, props.focus) : openId
    const candidate = data.candidates.find((entry) => entry.id === wanted) ?? NO_CANDIDATE
    const t = useTranslations("hiring")
    const say = useHiringSay()
    const format = useHiringFormat()
    const view = useHiringCandidate(candidate, data, close)
    const job = view.job
    const reject = useHiringReject(view.closeDialog)
    const interview = useHiringInterviewRequest(
        useHiringInterviewForm(interviewDefaults(job, data.members, data.meUserId)),
        candidate.id,
    )
    const offer = useHiringOfferRequest(
        useHiringOfferForm(
            offerDefaults(job, job === undefined ? "" : format.pay(job.payMinVnd, job.payMaxVnd, job.payUnit)),
        ),
        candidate.id,
    )
    const cv = view.detail?.cv ?? null
    const closeDialog = () => {
        interview.reset()
        offer.reset()
        reject.reset()
        view.closeDialog()
    }
    return (
        <HiringCandidateBase
            props={{
                say,
                isOpen: candidate.id !== "",
                name: candidate.name,
                subtitle: [job?.title ?? "", format.label("source", candidate.source)]
                    .filter((part) => part !== "")
                    .join(" · "),
                stageLabel: t(`stage_${candidate.stage}`),
                stageTone: stageTone(candidate.stage),
                contacts: [candidate.phone, candidate.email].filter((line) => line !== ""),
                canSchedule: !view.isClosed && !view.hasOpenInterview,
                canOffer: !view.isClosed && !view.hasOpenOffer,
                canShortlist: candidate.stage === "applied" || candidate.stage === "screening",
                canReject: !view.isClosed,
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
                notes: view.notes,
                canSaveNotes: view.notes !== candidate.notes,
                retention: t("candRetention", { days: view.retentionDays }),
                dialog: view.dialog,
                isBusy: view.isPending,
                error: view.error,
                notice: view.notice,
                interview: {
                    say,
                    name: candidate.name,
                    members: data.members.map((member) => ({
                        id: member.userId,
                        label: member.windows.length > 0 ? member.name : t("ivNoWindows", { name: member.name }),
                    })),
                    modes: INTERVIEW_MODES.map((mode) => ({ id: mode, label: t(`ivMode_${mode}`) })),
                    values: interview.values,
                    outcome: interview.outcome,
                    canSend: interview.canSend,
                    isBusy: interview.isPending,
                    error: interview.error,
                },
                offer: {
                    say,
                    name: candidate.name,
                    values: offer.values,
                    outcome: offer.outcome,
                    canSend: offer.canSend,
                    isBusy: offer.isPending,
                    error: offer.error,
                },
                reject: {
                    say,
                    name: candidate.name,
                    reason: reject.reason,
                    canConfirm: reject.canConfirm,
                    isBusy: reject.isPending,
                    error: reject.error,
                },
            }}
            on={{
                openDialog: view.openDialog,
                closeDialog,
                shortlist: view.shortlist,
                rescreen: view.rescreen,
                toggleCv: view.toggleCv,
                notes: view.setNotes,
                saveNotes: view.saveNotes,
                cancelOffer: view.cancelOffer,
                remove: () => void view.remove(),
                clear: view.clear,
                close,
                interviewText: interview.setText,
                interviewNumber: interview.setNumber,
                sendInterview: interview.send,
                offerText: offer.setText,
                sendOffer: offer.send,
                rejectReason: reject.setReason,
                confirmReject: () => void reject.confirm(candidate.id),
            }}
        />
    )
}
