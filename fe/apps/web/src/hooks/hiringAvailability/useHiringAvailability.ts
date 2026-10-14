"use client"

import { useTranslations } from "next-intl"
import { useState } from "react"
import { useHiringRun } from "@/hooks/hiring"
import type { HiringMemberView } from "@/hooks/hiringWire"
import { useMutateSaveHiringAvailabilitySwr } from "@/hooks/swr"
import { WEEKDAYS, memberTexts, parseWindows } from "./hiringAvailability.shared"

/** The availability form: the member being edited, the text of each weekday, the weekdays that are not time ranges, and the save. */
export const useHiringAvailability = (members: ReadonlyArray<HiringMemberView>, meUserId: string) => {
    const t = useTranslations("hiring")
    const run = useHiringRun()
    const { trigger } = useMutateSaveHiringAvailabilitySwr()
    const [who, setWho] = useState(
        members.find((member) => member.userId === meUserId)?.userId ?? members[0]?.userId ?? "",
    )
    const [texts, setTexts] = useState<Record<number, string>>(() =>
        memberTexts(members.find((member) => member.userId === who)),
    )
    const invalid = WEEKDAYS.filter((weekday) => parseWindows(weekday, texts[weekday] ?? "") === null)
    return {
        who,
        texts,
        invalid,
        isPending: run.isPending,
        error: run.error,
        notice: run.notice,
        pick: (userId: string) => {
            run.clear()
            setWho(userId)
            setTexts(memberTexts(members.find((member) => member.userId === userId)))
        },
        setText: (weekday: number, text: string) => {
            run.clear()
            setTexts((current) => ({ ...current, [weekday]: text }))
        },
        save: () => {
            const windows = WEEKDAYS.flatMap((weekday) => parseWindows(weekday, texts[weekday] ?? "") ?? [])
            void run.exec(
                () => trigger({ memberUserId: who, windows }),
                (saved) => t("availSaved", { n: saved.saved }),
            )
        },
    }
}
