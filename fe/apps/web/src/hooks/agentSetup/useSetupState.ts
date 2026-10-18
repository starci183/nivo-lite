"use client"

import { useMemo } from "react"
import { slotOfSwr } from "@/hooks/slot"
import type { SetupWrite, DataSlot } from "@/modules/types"
import type { SetupMessage, SetupRevision, SetupSession } from "@/modules/installations"

import { toSetupWrite } from "@/hooks/setupCards"
import { SETUP_POLL_MS, toSetupMessage, toSetupRevision, toSetupSession } from "./agentSetup.shared"
import { useQuerySetupStateSwr } from "@/hooks/swr"

/** The setup chat of one instance: its draft, the whole chat, the confirm cards, and whether NIVO is still answering. */
export interface SetupStateView {
    /** The instance: the label and whether its type allows several, and the version in use. */
    readonly instance: { readonly name: string; readonly isMulti: boolean; readonly activeVersionId: string | null }
    readonly session: SetupSession
    readonly revisions: ReadonlyArray<SetupRevision>
    readonly messages: ReadonlyArray<SetupMessage>
    readonly writes: ReadonlyArray<SetupWrite>
    readonly turnPending: boolean
}

/** Reads the setup of an instance; while NIVO answers it reads again every couple of seconds until the reply is in. */
export const useSetupState = (
    installationId: string,
): { readonly slot: DataSlot<SetupStateView>; readonly reload: () => void } => {
    const read = useQuerySetupStateSwr(
        { installationId },
        { refreshInterval: (latest) => (latest?.turnPending === true ? SETUP_POLL_MS : 0) },
    )
    const { data, mutate } = read
    const view = useMemo(
        (): SetupStateView | undefined =>
            data === undefined
                ? undefined
                : {
                      instance: {
                          name: data.installation.name,
                          isMulti: data.installation.isMulti,
                          activeVersionId: data.installation.activeContextVersionId ?? null,
                      },
                      session: toSetupSession(data.session),
                      revisions: data.revisions.map(toSetupRevision),
                      messages: data.messages.map(toSetupMessage),
                      writes: data.cards.flatMap((card) => toSetupWrite(card) ?? []),
                      turnPending: data.turnPending,
                  },
        [data],
    )
    return {
        slot: slotOfSwr({ data: view, error: read.error, isLoading: read.isLoading }),
        reload: () => void mutate(),
    }
}
