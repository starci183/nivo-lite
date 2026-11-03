"use client"
import type { HiringViews, HiringWorkbenchCopy, HiringRequestOutcome, FieldOf } from "@/modules/types"
import { useTranslations } from "next-intl"
import { hiringRejectCopyOf, useHiringFormat, useHiringSay, type HiringOwner } from "@/hooks/hiring"

import {
    INTERVIEW_MODES,
    interviewDefaults,
    offerDefaults,
    useHiringInterviewRequest,
    useHiringOfferRequest,
    type InterviewValues,
    type OfferValues,
} from "@/hooks/hiringCandidate"
import { useHiringReject } from "@/hooks/hiringPipeline"
import type { CandidateView, HiringWorkbenchData } from "@/hooks/hiringWire"
import { useHiringInterviewForm, useHiringOfferForm } from "@/hooks/rhf"
import { useFeatureReset } from "@/hooks/reuseables"
import type { Dispatch, SetStateAction } from "react"

interface CandidateDialogsInput {
    readonly candidate: CandidateView
    readonly data: HiringWorkbenchData
    readonly copy: HiringViews["workbenchCopy"]
    readonly owner: HiringOwner
    readonly onClose: () => void
}
interface RequestProjection {
    readonly input: CandidateDialogsInput
    readonly t: ReturnType<typeof useTranslations<"hiring">>
    readonly say: ReturnType<typeof useHiringSay>
    readonly interview: ReturnType<typeof useHiringInterviewRequest>
    readonly offer: ReturnType<typeof useHiringOfferRequest>
    readonly reject: ReturnType<typeof useHiringReject>
}

/** Resolves each actual request's record title and existing options, outcomes and feedback. */
const requestProps = (context: RequestProjection) => {
    const { input, t, say, interview, offer, reject } = context
    return {
        interview: {
            copy: input.copy,
            title: t("ivTitle", { name: input.candidate.name }),
            members: input.data.members.map((member) => ({
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
            copy: input.copy,
            title: t("offerTitle", { name: input.candidate.name }),
            values: offer.values,
            outcome: offer.outcome,
            canSend: offer.canSend,
            isBusy: offer.isPending,
            error: offer.error,
        },
        reject: {
            copy: hiringRejectCopyOf(say, input.candidate.name),
            reason: reject.reason,
            canConfirm: reject.canConfirm,
            isBusy: reject.isPending,
            error: reject.error,
        },
    }
}

/** The view `useHiringCandidateDialogsView` returns. */
export interface HiringCandidateDialogsView {
    props: {
        interview: {
            copy: HiringWorkbenchCopy
            title: string
            members: {
                id: string
                label: string
            }[]
            modes: {
                id: string
                label: string
            }[]
            values: InterviewValues
            outcome: HiringRequestOutcome | null
            canSend: boolean
            isBusy: boolean
            error: string | null
        }
        offer: {
            copy: HiringWorkbenchCopy
            title: string
            values: OfferValues
            outcome: HiringRequestOutcome | null
            canSend: boolean
            isBusy: boolean
            error: string | null
        }
        reject: {
            copy: {
                title: string
                closeLabel: string
                hint: string
                failed: string
                reasonLabel: string
                kept: string
                cancelLabel: string
                confirmLabel: string
            }
            reason: string
            canConfirm: boolean
            isBusy: boolean
            error: string | null
        }
    }
    on: {
        close: () => void
        interview: {
            text: (name: FieldOf<InterviewValues, string>, value: string) => void
            number: (name: FieldOf<InterviewValues, number>, value: number) => void
            send: () => void
            close: () => void
        }
        offer: {
            text: (name: FieldOf<OfferValues, string>, value: string) => void
            send: () => void
            close: () => void
        }
        reject: {
            reason: Dispatch<SetStateAction<string>>
            confirm: () => void
            close: () => void
        }
    }
}

/** Owns the three candidate-dialog forms and their original shared close/reset boundary. */
export const useHiringCandidateDialogsView = (input: CandidateDialogsInput): HiringCandidateDialogsView => {
    const t = useTranslations("hiring")
    const say = useHiringSay()
    const format = useHiringFormat()
    const job = input.data.jobs.find((job) => job.id === input.candidate.jobId)
    const interview = useHiringInterviewRequest(
        useHiringInterviewForm(interviewDefaults(job, input.data.members, input.data.meUserId)),
        input.candidate.id,
        input.owner,
    )
    const offer = useHiringOfferRequest(
        useHiringOfferForm(
            offerDefaults(job, job === undefined ? "" : format.pay(job.payMinVnd, job.payMaxVnd, job.payUnit)),
        ),
        input.candidate.id,
        input.owner,
    )
    const reject = useHiringReject(input.onClose, input.owner)
    const reset = () => {
        interview.reset()
        offer.reset()
        reject.reset()
    }
    useFeatureReset({ isActive: input.owner.isActive, isReady: true, scope: input.owner.scope, onReset: reset })
    const close = () => {
        reset()
        input.onClose()
    }
    return {
        props: requestProps({ input, t, say, interview, offer, reject }),
        on: {
            close,
            interview: { text: interview.setText, number: interview.setNumber, send: interview.send, close },
            offer: { text: offer.setText, send: offer.send, close },
            reject: { reason: reject.setReason, confirm: () => reject.confirm(input.candidate.id), close },
        },
    }
}
