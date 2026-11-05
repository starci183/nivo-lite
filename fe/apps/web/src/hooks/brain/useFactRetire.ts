"use client"

import { useTranslations } from "next-intl"
import { useState } from "react"
import { useBrainCommand } from "./useBrainCommand"

/** The stop of a fact's use: the fact it is asked for, the one being sent, and the steps. */
interface FactRetire {
    readonly asking: string | null
    readonly pending: string | undefined
    /** Asks before stopping a fact (or withdraws the question with null). */
    readonly ask: (id: string | null) => void
    /** The answer was yes: sends the stop. */
    readonly confirm: () => Promise<void>
}

/** Stopping the use of a fact asks first; only a member who may write sends it, one at a time. */
export const useFactRetire = (canWrite: boolean): FactRetire => {
    const t = useTranslations("brain")
    const command = useBrainCommand()
    const [asking, setAsking] = useState<string | null>(null)
    const [pending, setPending] = useState<string | undefined>()
    return {
        asking,
        pending,
        ask: (id) => setAsking(canWrite ? id : null),
        confirm: async () => {
            setAsking(null)
            if (asking === null || !canWrite || pending !== undefined) return
            setPending(asking)
            try {
                await command.send("fact.decide", { id: asking, action: "retire" }, { done: t("retiredDone") })
            } finally {
                setPending(undefined)
            }
        },
    }
}
