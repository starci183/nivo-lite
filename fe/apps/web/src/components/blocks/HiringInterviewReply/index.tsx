"use client"

import { useTranslations } from "next-intl"
import { useHiringFormat, useHiringSay } from "@/hooks/hiring"
import { useHiringInterviewReply, usePublicHiringInterview, type PublicInterviewView } from "@/hooks/hiringPublic"
import { slotOfSwr, useSlotLabels } from "@/hooks/slot"
import { HiringInterviewReplyBase } from "./component"
import type { HiringInterviewReplyShape } from "./component"

/** The token of the candidate's own link. */
interface HiringInterviewReplyProps {
    readonly token: string
}

/** How the invitation stands: waiting for a pick, confirmed, or closed; a proposed shape stands in while it is read. */
const shapeOf = (view: PublicInterviewView | undefined): HiringInterviewReplyShape => {
    if (view === undefined) return "proposed"
    if (view.status === "confirmed" || view.status === "proposed") return view.status
    return "closed"
}

/** The connected interview link: reads the invitation without a session and sends the chosen time through the back end GraphQL API. */
export const HiringInterviewReply = (props: HiringInterviewReplyProps) => {
    const t = useTranslations("hiring")
    const say = useHiringSay()
    const format = useHiringFormat()
    const slotLabels = useSlotLabels()
    const read = usePublicHiringInterview(props.token)
    const reply = useHiringInterviewReply(props.token)
    const view = read.view
    const location = view === undefined || view.location === "" ? "" : ": " + view.location
    const where = view === undefined ? "" : t("ivMode_" + view.mode) + location
    return (
        <HiringInterviewReplyBase
            shape={shapeOf(view)}
            props={{
                say,
                slot: slotOfSwr({
                    data:
                        view === undefined
                            ? undefined
                            : {
                                  shop: view.shop,
                                  heading: t("replyInterviewHeading", { name: view.candidateName, job: view.jobTitle }),
                                  detail: t("replyInterviewDetail", {
                                      where,
                                      minutes: view.durationMin,
                                      interviewer: view.interviewerName === "" ? "none" : view.interviewerName,
                                  }),
                                  confirmedTitle: view.slotStart
                                      ? t("replyConfirmedAt", { when: format.dateTime(view.slotStart) })
                                      : "",
                                  slots: view.slots.map((slot) => ({
                                      start: slot.start,
                                      label: format.dateTime(slot.start),
                                  })),
                              },
                    error: read.isMissing ? say("replyInvalid") : undefined,
                    isLoading: read.isLoading,
                }),
                slotLabels: { ...slotLabels(say("replyInvalid")), error: say("replyInvalid") },
                outcome: reply.outcome,
                isBusy: reply.isPending,
            }}
            on={{ pick: reply.pick, retry: read.reload }}
        />
    )
}
