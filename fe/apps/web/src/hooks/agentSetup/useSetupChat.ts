import { useCallback, useState } from "react"
import { mutate } from "swr"
import { useMutateDecideSetupCardSwr, useMutatePostSetupMessageSwr, QUERY_SETUP_STATE_SWR_KEY } from "@/hooks/swr"
import type { WriteDecision } from "@/lib/module-setup-writes"
import { useGraphQLWithToast } from "@/modules/toast"
import { toCardDecision } from "@/hooks/setupCards"

const isSetupStateKey = (key: unknown): boolean => Array.isArray(key) && key[0] === QUERY_SETUP_STATE_SWR_KEY

/**
 * The commands of the setup chat: the owner writes a message (NIVO answers in the background; the state is read again until the reply
 * is in) and settles the confirm cards. A failure was already toasted with the server message.
 */
export const useSetupChat = (setupSessionId: string, isAnswering: boolean) => {
    const runGraphQL = useGraphQLWithToast()
    const post = useMutatePostSetupMessageSwr()
    const decideCard = useMutateDecideSetupCardSwr()
    const [text, setText] = useState("")
    const [decidingId, setDecidingId] = useState("")
    const send = useCallback(async (): Promise<void> => {
        const body = text.trim()
        if (body === "") return
        const posted = await runGraphQL(() => post.trigger({ setupSessionId, text: body }), { showSuccessToast: false })
        if (posted === undefined) return
        setText("")
        await mutate(isSetupStateKey)
    }, [text, runGraphQL, post, setupSessionId])
    const decide = useCallback(
        async (cardId: string, change: WriteDecision): Promise<void> => {
            setDecidingId(cardId)
            await runGraphQL(() => decideCard.trigger({ cardId, change: toCardDecision(change) }), {
                showSuccessToast: false,
            })
            await mutate(isSetupStateKey)
            setDecidingId("")
        },
        [runGraphQL, decideCard],
    )
    return { text, setText, isSending: post.isMutating || isAnswering, send, decide, decidingId }
}
