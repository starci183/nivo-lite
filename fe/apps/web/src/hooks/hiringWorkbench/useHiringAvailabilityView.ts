"use client"
import { useTranslations } from "next-intl"
import { WEEKDAYS, useHiringAvailability } from "@/hooks/hiringAvailability"
import type { HiringViewInput } from "./hiringWorkbench.shared"

type ResolvedActions = {
    readonly member: (id: string) => void
    readonly text: (weekday: number, text: string) => void
    readonly save: () => void
}

/** Owns HiringAvailability's resolved data, commands and actual panel activation. */
export const useHiringAvailabilityView = (input: HiringViewInput) => {
    const owner = { isActive: input.isActive && input.isReady, scope: input.scope }

    const t = useTranslations("hiring")
    const { members, meUserId } = input.board
    const view = useHiringAvailability(members, meUserId, owner)

    const props = {
        copy: input.copy,
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
    }
    const on: ResolvedActions = { member: view.pick, text: view.setText, save: view.save }
    return { props, on }
}
