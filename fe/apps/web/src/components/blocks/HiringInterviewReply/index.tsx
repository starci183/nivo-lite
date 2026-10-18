"use client"

import { useTranslations } from "next-intl"
import { useHiringFormat, useHiringSay } from "@/hooks/hiring"
import { useHiringInterviewReply, usePublicHiringInterview, type PublicInterviewView } from "@/hooks/hiringPublic"

import { HiringInterviewReplyBase, type HiringInterviewReplyBaseProps } from "./component"

/** The token of the candidate's own link. */
interface HiringInterviewReplyProps {
    readonly token: string
}

type ReplyState = HiringInterviewReplyBaseProps["props"]["state"]

/** Where the invitation stands: still loading, no longer valid, waiting for a pick, confirmed, or closed. */
const stateOf = (isMissing: boolean, view: PublicInterviewView | undefined): ReplyState => {
    if (isMissing) return "missing"
    if (view === undefined) return "loading"
    if (view.status === "confirmed" || view.status === "proposed") return view.status
    return "closed"
}

/** The connected interview link: reads the invitation without a session and sends the chosen time through the back end GraphQL API. */
export const HiringInterviewReply = (props: HiringInterviewReplyProps) => {
    const t = useTranslations("hiring")
    const say = useHiringSay()
    const format = useHiringFormat()
    const read = usePublicHiringInterview(props.token)
    const reply = useHiringInterviewReply(props.token)
    const view = read.view
    const location = view === undefined || view.location === "" ? "" : ": " + view.location
    const where = view === undefined ? "" : t("ivMode_" + view.mode) + location
    return (
        <HiringInterviewReplyBase
            props={{
                say,
                state: stateOf(read.isMissing, view),
                shop: view?.shop ?? "",
                heading: t("replyInterviewHeading", { name: view?.candidateName ?? "", job: view?.jobTitle ?? "" }),
                detail: t("replyInterviewDetail", {
                    where,
                    minutes: view?.durationMin ?? 0,
                    interviewer: view === undefined || view.interviewerName === "" ? "none" : view.interviewerName,
                }),
                confirmedTitle: view?.slotStart ? t("replyConfirmedAt", { when: format.dateTime(view.slotStart) }) : "",
                slots: (view?.slots ?? []).map((slot) => ({ start: slot.start, label: format.dateTime(slot.start) })),
                outcome: reply.outcome,
                isBusy: reply.isPending,
            }}
            on={{ pick: reply.pick }}
        />
    )
}
