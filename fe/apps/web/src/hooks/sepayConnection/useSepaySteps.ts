"use client"

import { useTranslations } from "next-intl"
import { useState } from "react"
import type { SepayConnectionView, SepayStepId } from "@/modules/types"
import { sepaySetupDone } from "./sepayConnection.shared"
import { useSepayConnection } from "./useSepayConnection"

/** One setup step as the page draws its head: done or not, the one-line summary beside its title, and whether it is open. */
export interface SepayStepState {
    readonly id: SepayStepId
    readonly isDone: boolean
    readonly summary: string
    readonly isOpen: boolean
}

/**
 * The five setup steps of a SePay connection in back end order (environment, bank account, the webhook on SePay, the test, the agent
 * and matching): each says whether it is done, the first step not done opens on its own, and the reader opens or closes any step.
 */
export const useSepaySteps = (connectionId: string) => {
    const t = useTranslations("sepayConnection")
    const { slot } = useSepayConnection(connectionId)
    const [toggled, setToggled] = useState<Readonly<Partial<Record<SepayStepId, boolean>>>>({})
    const view = slot.items
    const summaryOf = (id: SepayStepId, isDone: boolean, connection: SepayConnectionView): string => {
        switch (id) {
            case "environment":
                return t(connection.environment === "test" ? "envTest" : "envLive")
            case "account":
                return isDone
                    ? t("stepAccountDone", { bank: connection.bank, account: connection.accountMasked })
                    : t("stepAccountTodo")
            case "paste":
                return isDone ? t("stepPasteDone") : t("stepTodo")
            case "test":
                return isDone ? t("stepTestDone") : t("stepTodo")
            case "agents":
                return isDone ? t("stepAgentsDone", { count: connection.agentIds.length }) : t("stepAgentsTodo")
        }
    }
    const done = view === undefined ? [] : sepaySetupDone(view)
    const opensOn = done.find(([, isDone]) => !isDone)?.[0] ?? null
    const steps: ReadonlyArray<SepayStepState> =
        view === undefined
            ? []
            : done.map(([id, isDone]) => ({
                  id,
                  isDone,
                  summary: summaryOf(id, isDone, view),
                  isOpen: toggled[id] ?? id === opensOn,
              }))
    return {
        steps,
        toggle: (id: SepayStepId, isOpen: boolean) => setToggled((current) => ({ ...current, [id]: isOpen })),
    }
}
