"use client"

import { useQueryLoadTelegramUserSetupSwr, useQueryTelegramUserReadySwr } from "@/hooks/swr"
import { slotOfReads, type SlotRead } from "@/hooks/slot"
import type { DataSlot } from "@/modules/types"
import { BLANK_INITIAL, chatKindOf, sinceDaysOf, type TelegramInitial } from "@/hooks/telegram-chats"

/** Revalidates on open while settled cached content remains visible. */
const FRESH = { revalidateOnFocus: false, revalidateOnReconnect: false, shouldRetryOnError: false } as const

/** What the wizard draws from once both reads settled: the server's business position and where the wizard starts. */
export interface TelegramBootData {
    /** Whether the server has Telegram app credentials; a business fact, not a read status. */
    readonly isConfigured: boolean
    /** Where the wizard starts. */
    readonly initial: TelegramInitial
}

/** What the wizard knows before it can draw its first step. */
export interface TelegramBoot {
    readonly reads: ReadonlyArray<SlotRead<unknown>>
    /** The status of the reads (the server state, and the saved state when resuming) with their answer once settled. */
    readonly slot: DataSlot<TelegramBootData>
    readonly bootData: { readonly isConfigured: boolean } | undefined
    /** The failure message of the read that failed without data; none when no read failed or it carried no text. */
    readonly error: string | null
    /** Reads the server and the saved state again. */
    readonly retry: () => void
}

/** The initial position of a resumed login or an edit, from the saved state. */
const resumedOf = (state: NonNullable<ReturnType<typeof useQueryLoadTelegramUserSetupSwr>["data"]>): TelegramInitial => {
    const done = state.stage === "ready"
    return {
        name: state.name,
        consent: state.consent,
        everyMinutes: state.everyMinutes ?? null,
        picked: (state.config?.chats ?? []).map((chat) => ({
            id: chat.id,
            title: chat.title,
            kind: chatKindOf(chat.kind),
        })),
        sinceDays: sinceDaysOf(state.config?.sinceDays ?? 7),
        stage: state.stage === "password" ? "password" : "code",
        index: done ? 2 : 1,
        editing: done,
    }
}

/** Whether the server is configured and where a resumed login or edit starts; revalidation never blanks settled data. */
export const useTelegramUserBoot = (resumeId: string | undefined): TelegramBoot => {
    const ready = useQueryTelegramUserReadySwr(FRESH)
    const setup = useQueryLoadTelegramUserSetupSwr(resumeId, FRESH)
    const isConfigured = ready.data?.configured
    // An unconfigured server never reads the saved state: its failure would hide the business answer.
    const reads: ReadonlyArray<SlotRead<unknown>> =
        resumeId === undefined || isConfigured === false ? [ready] : [ready, setup]
    const retry = () => {
        void ready.mutate()
        if (resumeId !== undefined) void setup.mutate()
    }
    const slot = slotOfReads(reads, (): TelegramBootData | undefined => {
        if (isConfigured === undefined) return undefined
        if (!isConfigured || resumeId === undefined) return { isConfigured, initial: BLANK_INITIAL }
        return setup.data === undefined ? undefined : { isConfigured, initial: resumedOf(setup.data) }
    })
    const failed = reads.find((read) => read.data === undefined && read.error !== undefined)
    return {
        reads,
        slot,
        bootData: isConfigured === undefined ? undefined : { isConfigured },
        error: failed?.error instanceof Error ? failed.error.message : null,
        retry,
    }
}
