"use client"

import { useEffect, useMemo, useState } from "react"
import { slotOfSwr } from "@/hooks/slot"
import { displayNameOf } from "@/modules/installations"
import type { SetupWrite, DataSlot } from "@/modules/types"
import type { SetupMessage, SetupRevision, SetupSession } from "@/modules/installations"

import { toSetupWrite } from "@/hooks/setupCards"
import {
    SETUP_POLL_MS,
    setupTurnStaleAt,
    setupTurnStateAt,
    toSetupMessage,
    toSetupRevision,
    toSetupSession,
} from "./agentSetup.shared"
import type { SetupTurnState } from "./agentSetup.shared"
import { useQuerySetupStateSwr } from "@/hooks/swr"

/** The setup chat of one instance: its draft, the whole chat, the confirm cards, and whether NIVO is still answering. */
export interface SetupStateView {
    /** The instance: the label and whether its type allows several, and the version in use. */
    readonly instance: { readonly name: string; readonly isMulti: boolean; readonly activeVersionId: string | null }
    readonly session: SetupSession
    readonly revisions: ReadonlyArray<SetupRevision>
    readonly messages: ReadonlyArray<SetupMessage>
    readonly writes: ReadonlyArray<SetupWrite>
    /** NIVO is answering the last owner message. */
    readonly turnPending: boolean
    /** Where the turn stands: a turn that waited past the timeout was lost, and the owner may write again. */
    readonly turn: SetupTurnState
}

/** The wire shape the poll reads: whether a turn waits, and the messages to date it by. */
type PollShape = {
    readonly turnPending: boolean
    readonly session: { readonly id: string }
    readonly messages: ReadonlyArray<{
        readonly setupSessionId: string
        readonly role: string
        readonly createdAt: string
    }>
}

/** When the turn the read reports counts as lost; null when none waits. */
const staleAtOf = (data: PollShape): number | null => setupTurnStaleAt(data.turnPending, data.messages, data.session.id)

/** Reads the setup of an instance; while NIVO answers it reads again every couple of seconds until the reply is in or the turn is lost. */
export const useSetupState = (
    installationId: string,
): { readonly slot: DataSlot<SetupStateView>; readonly reload: () => void } => {
    const read = useQuerySetupStateSwr({ installationId })
    const { data, mutate } = read
    const staleAt = data === undefined ? null : staleAtOf(data)
    const nowMs = useStaleClock(staleAt)
    useTurnPoll(setupTurnStateAt(staleAt, nowMs) === "answering", mutate)
    const view = useMemo(
        (): SetupStateView | undefined =>
            data === undefined
                ? undefined
                : {
                      instance: {
                          name: displayNameOf(data.installation),
                          isMulti: data.installation.isMulti,
                          activeVersionId: data.installation.activeContextVersionId ?? null,
                      },
                      session: toSetupSession(data.session),
                      revisions: data.revisions.map(toSetupRevision),
                      messages: data.messages.map(toSetupMessage),
                      writes: data.cards.flatMap((card) => toSetupWrite(card) ?? []),
                      ...turnOf(staleAt, nowMs),
                  },
        [data, staleAt, nowMs],
    )
    return {
        slot: slotOfSwr({ data: view, error: read.error, isLoading: read.isLoading }),
        reload: () => void mutate(),
    }
}

/** Reads again every couple of seconds while NIVO answers. A timer of its own: an SWR refresh interval that starts at zero never wakes. */
const useTurnPoll = (isAnswering: boolean, reread: () => unknown): void => {
    useEffect(() => {
        if (!isAnswering) return undefined
        const timer = setInterval(() => void reread(), SETUP_POLL_MS)
        return () => clearInterval(timer)
    }, [isAnswering, reread])
}

/** Whether NIVO is answering, and where the turn stands, at the moment given. */
const turnOf = (staleAt: number | null, nowMs: number): Pick<SetupStateView, "turnPending" | "turn"> => {
    const turn = setupTurnStateAt(staleAt, nowMs)
    return { turnPending: turn === "answering", turn }
}

/** The moment the turn is judged at: now, and again once when a waiting turn passes its timeout, so a lost turn opens the composer. */
const useStaleClock = (staleAt: number | null): number => {
    const [nowMs, setNowMs] = useState(() => Date.now())
    useEffect(() => {
        if (staleAt === null || !Number.isFinite(staleAt)) return undefined
        const timer = setTimeout(() => setNowMs(Date.now()), Math.max(0, staleAt - Date.now()))
        return () => clearTimeout(timer)
    }, [staleAt])
    return nowMs
}
