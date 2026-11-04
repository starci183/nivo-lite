import { useLoyaltyCommand, type LoyaltyPanelActivation } from "@/hooks/loyalty"
import { useRef, useState } from "react"
import { newIdempotencyToken } from "@/modules/utils"
import { useFeatureReset } from "@/hooks/reuseables"
import { useMemberCommands, type ActionNote, type CommandToken, type MemberFields } from "./useMemberCommands"

/** Keeps a command's idempotency token out of render: only the returned functions, run by events, read or replace it. */
const useCommandToken = (): CommandToken => {
    const token = useRef(newIdempotencyToken())
    return {
        next: () => token.current,
        renew: () => {
            token.current = newIdempotencyToken()
        },
    }
}

/** The view `useMemberActions` returns. */
export interface MemberActionsView {
    /** Saves name, birthday and note. */
    save: (fields: MemberFields) => void
    /** Records a signed point adjustment; calls `onDone` when the back end took it (posted or waiting). */
    adjust: (points: number, reason: string, onDone: () => void) => void
    /** Redeems a reward for the member and tells whether it went through or waits for approval. */
    redeem: (rewardId: string) => void
    isPending: boolean
    clear: () => void
    busyReward: string | null
    adjustNote: string | null
    redeemNote: ActionNote | null
}

/** What the member page writes: details, point adjustments and redemptions, each toasted and followed by a revalidation. */
export const useMemberActions = (customerId: string, activation: LoyaltyPanelActivation): MemberActionsView => {
    const adjustToken = useCommandToken()
    const redeemToken = useCommandToken()
    const [busyReward, setBusyReward] = useState<string | null>(null)
    const [adjustNote, setAdjustNote] = useState<string | null>(null)
    const [redeemNote, setRedeemNote] = useState<ActionNote | null>(null)
    const scope = JSON.stringify([activation.scope, customerId])
    const command = useLoyaltyCommand({ ...activation, scope, isActive: activation.isActive && customerId !== "" })
    useFeatureReset({
        ...activation,
        scope,
        onReset: () => {
            setBusyReward(null)
            setAdjustNote(null)
            setRedeemNote(null)
            adjustToken.renew()
            redeemToken.renew()
        },
    })
    const commands = useMemberCommands({
        customerId,
        activation,
        command,
        adjustToken,
        redeemToken,
        setBusyReward,
        setAdjustNote,
        setRedeemNote,
    })
    return {
        isPending: command.isPending,
        clear: () => {
            setAdjustNote(null)
            setRedeemNote(null)
        },
        busyReward,
        adjustNote,
        redeemNote,
        ...commands,
    }
}
