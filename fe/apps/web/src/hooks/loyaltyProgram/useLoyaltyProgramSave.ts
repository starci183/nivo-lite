"use client"

import { useTranslations } from "next-intl"
import { useTransition } from "react"
import { useSWRConfig } from "swr"
import { QUERY_LOYALTY_BOARD_SWR_KEY, QUERY_LOYALTY_PROGRAM_SWR_KEY, useMutateSaveLoyaltyProgramSwr } from "@/hooks/swr"
import { matchesSwrKey } from "@/modules/utils"
import { useGraphQLWithToast } from "@/modules/toast"
import { programInputOf } from "./loyaltyProgram.shared"
import type { ProgramValues } from "@/modules/types"

/** Saves the whole programme; the answer becomes a toast and the programme and the board are read again. */
export const useLoyaltyProgramSave = () => {
    const t = useTranslations("loyalty")
    const withToast = useGraphQLWithToast()
    const { mutate } = useSWRConfig()
    const saveProgram = useMutateSaveLoyaltyProgramSwr()
    const [isPending, startTransition] = useTransition()
    return {
        isPending,
        save: (values: ProgramValues) =>
            startTransition(async () => {
                const answer = await withToast(() => saveProgram.trigger(programInputOf(values)), {
                    successMessage: t("programSaved"),
                })
                if (answer === undefined) return
                void mutate(matchesSwrKey(QUERY_LOYALTY_PROGRAM_SWR_KEY))
                void mutate(matchesSwrKey(QUERY_LOYALTY_BOARD_SWR_KEY))
            }),
    }
}
