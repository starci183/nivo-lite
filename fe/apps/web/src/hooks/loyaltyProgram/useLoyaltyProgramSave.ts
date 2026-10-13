"use client"

import { useTranslations } from "next-intl"
import { useTransition } from "react"
import { useSWRConfig } from "swr"
import {
    isQueryLoyaltyBoardSwrKey,
    isQueryLoyaltyProgramSwrKey,
    useMutateSaveLoyaltyProgramSwr,
} from "@/hooks/swr/api/graphql"
import { useGraphQLWithToast } from "@/modules/toast"
import { programInputOf } from "./loyaltyProgram.shared"
import type { ProgramValues } from "./loyaltyProgram.shared"

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
                void mutate(isQueryLoyaltyProgramSwrKey)
                void mutate(isQueryLoyaltyBoardSwrKey)
            }),
    }
}
