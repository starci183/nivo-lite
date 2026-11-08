"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
import { useHiringFormat, useHiringSay } from "@/hooks/hiring"
import { useHiringInterviewReply, usePublicHiringInterview, type PublicInterviewView } from "@/hooks/hiringPublic"
import { useLocaleSwitch } from "@/hooks/locale"
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
    const language = useLocaleSwitch()
    const [selected, setSelected] = useState("")
    const [isMissing, setMissing] = useState(false)
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
                slot: read.isMissing
                    ? { isEmpty: true }
                    : slotOfSwr({
                          data:
                              view === undefined
                                  ? undefined
                                  : {
                                        shop: view.shop,
                                        heading: t("replyInterviewHeading", {
                                            name: view.candidateName,
                                            job: view.jobTitle,
                                        }),
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
                                            label: `${format.shortDay(slot.start)} \u00b7 ${format.time(slot.start)}`,
                                        })),
                                    },
                          error: read.isFailed ? true : undefined,
                          isLoading: read.isLoading,
                      }),
                slotLabels: { ...slotLabels(say("replyInvalid")), error: say("replyLoadFailed") },
                failedBody: say("replyLoadFailedBody"),
                outcome: reply.outcome,
                isBusy: reply.isPending,
                selected,
                isMissing,
                language: {
                    label: language.label,
                    locale: language.locale,
                    isPending: language.isPending,
                    options: language.options,
                },
            }}
            on={{
                select: (start) => {
                    setSelected(start)
                    setMissing(false)
                },
                confirm: () => {
                    setMissing(selected === "")
                    if (selected !== "") reply.pick(selected)
                },
                pick: reply.pick,
                retry: read.reload,
                chooseLanguage: language.choose,
            }}
        />
    )
}
