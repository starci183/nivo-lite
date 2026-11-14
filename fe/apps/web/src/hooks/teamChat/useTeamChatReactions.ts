"use client"

import { useCallback, useEffect, useState } from "react"
import { useMutateReactToChatMessageSwr } from "@/hooks/swr"
import { useWorkspaceId } from "@/hooks/workspaces"
import { createReactionBatcher, type PendingTaps, type ReactionBatch } from "@/modules/teamChat"
import type { TeamChatReactionView } from "@/modules/types"

/** What the reactions of the open room do to the thread once a burst is confirmed. */
interface TeamChatReactionsInput {
    /** The store of the unconfirmed taps the thread lays over what it read; the room state makes it, so the thread and this hook share it. */
    readonly pending: PendingTaps
    /** Writes the reactions the door answered into the thread at once (the viewer's taps already counted). */
    readonly onConfirmed: (messageId: string, reactions: ReadonlyArray<TeamChatReactionView>) => void
    /** Reads the thread (and the pinned messages) again. */
    readonly onSettled: () => void
}

/** What a burst reads when it goes: the latest trigger and callbacks, kept current by an effect. */
class Latest {
    constructor(
        public trigger: ReturnType<typeof useMutateReactToChatMessageSwr>["trigger"],
        public input: TeamChatReactionsInput,
    ) {}

    /** Takes the trigger and the callbacks of the latest render. */
    update(trigger: Latest["trigger"], input: TeamChatReactionsInput): void {
        this.trigger = trigger
        this.input = input
    }
}

/** The view `useTeamChatReactions` returns. */
export interface TeamChatReactionsView {
    /** One tap of an emoji on a message; the taps within 600 ms go as one call with `times`. */
    readonly react: (messageId: string, emoji: string) => void
}

/**
 * The reactions of the open room. A tap counts at once (it is laid over the thread as a pending tap), the taps of a burst are
 * collected for 600 ms and go as one `reactToChatMessage` call with `times`, and one call per emoji and message is in flight at a
 * time. When the door answers, its reactions are written into the thread and the pending taps of that call are taken off; a refused
 * or failed call takes them off too and the thread is read again, so the screen settles on what the door holds.
 */
export const useTeamChatReactions = (input: TeamChatReactionsInput): TeamChatReactionsView => {
    const workspaceId = useWorkspaceId() ?? ""
    const { trigger } = useMutateReactToChatMessageSwr(workspaceId)
    const { pending } = input
    const [latest] = useState(() => new Latest(trigger, input))
    useEffect(() => {
        latest.update(trigger, input)
    })
    const [batcher] = useState(() =>
        createReactionBatcher(async (batch: ReactionBatch): Promise<void> => {
            const outcome = await latest
                .trigger({ messageId: batch.messageId, emoji: batch.emoji, times: batch.times })
                .then(
                    (answer) => ({ ok: true as const, answer }),
                    (cause: unknown) => ({ ok: false as const, cause }),
                )
            if (outcome.ok && outcome.answer.message !== null) {
                latest.input.onConfirmed(
                    batch.messageId,
                    outcome.answer.message.reactions.map((reaction) => ({
                        emoji: reaction.emoji,
                        count: reaction.count,
                        mine: reaction.mineCount,
                    })),
                )
            }
            pending.subtract(batch.messageId, batch.emoji, batch.times)
            latest.input.onSettled()
        }),
    )
    useEffect(() => () => batcher.flush(), [batcher])
    const react = useCallback(
        (messageId: string, emoji: string): void => {
            pending.add(messageId, emoji, 1)
            batcher.tap(messageId, emoji)
        },
        [batcher, pending],
    )
    return { react }
}
