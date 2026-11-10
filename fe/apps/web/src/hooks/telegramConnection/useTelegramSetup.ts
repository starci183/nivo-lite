"use client"

import { PHASE_COUNT, phaseOfLife } from "@/modules/connection-lifecycle"
import { useTelegramHead } from "./useTelegramHead"

type UseTelegramSetupResult = {
    /** The connection is set up or waits for its first message. */
    isUnfinished: boolean
    /** The connection waits for its first message. */
    isWaiting: boolean
    /** The phase the setup stands in (1-based). */
    current: number
    /** How many phases a setup has. */
    total: number
}

/** Where the setup of a Telegram bot connection stands among the four shared phases. */
export const useTelegramSetup = (connectionId: string): UseTelegramSetupResult => {
    const { life } = useTelegramHead(connectionId)
    return {
        isUnfinished: life !== null && (life.id === "setup" || life.id === "waiting"),
        isWaiting: life?.id === "waiting",
        current: life === null ? 1 : phaseOfLife(life),
        total: PHASE_COUNT,
    }
}
