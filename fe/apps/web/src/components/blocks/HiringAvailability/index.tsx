"use client"

import { useTranslations } from "next-intl"
import { useHiringSay, useHiringWorkbench } from "@/hooks/hiring"
import { WEEKDAYS, useHiringAvailability } from "@/hooks/hiringAvailability"
import { HiringAvailabilityBase } from "./component"

/** The connected availability card: when each member is free to interview, saved through the back end GraphQL API. */
export const HiringAvailability = () => {
    const t = useTranslations("hiring")
    const say = useHiringSay()
    const { members, meUserId } = useHiringWorkbench().board
    const view = useHiringAvailability(members, meUserId)
    return (
        <HiringAvailabilityBase
            props={{
                say,
                members: members.map((member) => ({ id: member.userId, label: member.name })),
                who: view.who,
                days: WEEKDAYS.map((weekday) => ({
                    weekday,
                    label: t(`weekday_${weekday}`),
                    text: view.texts[weekday] ?? "",
                    isInvalid: view.invalid.includes(weekday),
                })),
                canSave: view.invalid.length === 0,
                isBusy: view.isPending,
                error: view.error,
                notice: view.notice,
            }}
            on={{ member: view.pick, text: view.setText, save: view.save }}
        />
    )
}
