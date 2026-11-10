"use client"

import { useTranslations } from "next-intl"
import { useWizardPhases } from "@/hooks/connection-wizard"
import { PHASE_COUNT, phaseOfLife } from "@/modules/connection-lifecycle"
import { useSepayHead } from "./useSepayHead"

/** The setup card of a SePay connection, worded: the four phases, where it stands, and the one step left. */
interface SepaySetup {
    readonly title: string
    readonly phases: ReadonlyArray<string>
    readonly current: number
    readonly stateLabels: { readonly complete: string; readonly current: string; readonly upcoming: string }
    readonly next: { readonly title: string; readonly body: string }
}

/** The step each phase of an unfinished setup leaves: its title and the words under it, in the `sepayConnection` catalog. */
const NEXT_KEYS = {
    1: { title: "stepAccount", body: "stepAccountTodo" },
    2: { title: "stepPaste", body: "stepPasteHint" },
    3: { title: "checklistTitle", body: "waitingText" },
} as const

/** The setup card while the connection is set up or waits for its first transaction; undefined once it runs, ran, or is being read. */
export const useSepaySetup = (connectionId: string): SepaySetup | undefined => {
    const t = useTranslations("sepayConnection")
    const tc = useTranslations("connections")
    const phases = useWizardPhases("money")
    const { life } = useSepayHead(connectionId)
    if (life === null || (life.id !== "setup" && life.id !== "waiting")) return undefined
    const current = phaseOfLife(life)
    const next = NEXT_KEYS[current === 1 || current === 2 ? current : 3]
    return {
        title: tc("setupTitle", { n: current, total: PHASE_COUNT }),
        phases: phases.labels,
        current,
        stateLabels: phases.stateLabels,
        next: { title: t(next.title), body: t(next.body) },
    }
}
