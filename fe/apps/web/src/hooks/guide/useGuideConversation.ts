import { useTranslations } from "next-intl"
import { useCallback, useEffect, useRef, useState } from "react"
import { useMutateAskGuideSwr, useQueryAgentGenerationStatusSwr } from "@/hooks/swr"
import type { AgentGenerationStatusType } from "@/modules/api"
import { mapAnswer, modelAnswer } from "@/modules/guide"
import type { GuideReply, GuideTurn } from "@/modules/guide"
import { useGraphQLWithToast } from "@/modules/toast"
import { useGuideText } from "./useGuideText"

/** One line of the conversation: the member question or the guide reply. */
type GuideConversationMessage =
    | { readonly id: number; readonly role: "user"; readonly text: string }
    | { readonly id: number; readonly role: "guide"; readonly reply: GuideReply }

/** How long the guide waits for the model before it gives up, ms. */
const ANSWER_TIMEOUT_MS = 60_000

/** The turns the model sees, from the conversation so far. */
const historyOf = (messages: ReadonlyArray<GuideConversationMessage>): Array<GuideTurn> =>
    messages.map((message) =>
        message.role === "user" ? { role: "user", text: message.text } : { role: "guide", text: message.reply.answer },
    )

/**
 * The NIVO guide conversation. A question that clearly names a place is answered from the site map at once (no tokens); anything else
 * goes to the be `askGuide` door (which builds the prompt and limits each member) and its queued text is polled until the model
 * answers, the status cannot be read, or a minute passes.
 */
export const useGuideConversation = (isManager: boolean) => {
    const t = useTranslations("guide")
    const text = useGuideText()
    const runGraphQL = useGraphQLWithToast()
    const { trigger } = useMutateAskGuideSwr()
    const [messages, setMessages] = useState<ReadonlyArray<GuideConversationMessage>>([])
    const [isAsking, setIsAsking] = useState(false)
    const [generationId, setGenerationId] = useState<string | undefined>(undefined)
    const lastId = useRef(0)
    const nextId = useCallback(() => {
        lastId.current = Math.max(lastId.current + 1, Date.now())
        return lastId.current
    }, [])

    const answer = useCallback(
        (reply: GuideReply) => {
            const id = nextId()
            setMessages((current) => [...current, { id, role: "guide", reply }])
            setIsAsking(false)
            setGenerationId(undefined)
        },
        [nextId],
    )
    const fail = useCallback(() => answer({ answer: t("failed"), steps: [], links: [], source: "busy" }), [answer, t])

    useQueryAgentGenerationStatusSwr(generationId, {
        onSettled: (generation: AgentGenerationStatusType) =>
            answer(modelAnswer(generation.status === "done" ? (generation.output ?? null) : null, isManager, text)),
        onUnreachable: fail,
    })

    // Stop waiting (and polling) after a minute.
    useEffect(() => {
        if (generationId === undefined) return undefined
        const timer = setTimeout(fail, ANSWER_TIMEOUT_MS)
        return () => clearTimeout(timer)
    }, [generationId, fail])

    const ask = useCallback(
        async (question: string, path: string) => {
            const asked = question.trim()
            if (asked === "" || isAsking) return
            const history = historyOf(messages)
            const id = nextId()
            setMessages((current) => [...current, { id, role: "user", text: asked }])
            const fromMap = mapAnswer({ question: asked, isManager }, text)
            if (fromMap !== null) {
                answer(fromMap)
                return
            }
            setIsAsking(true)
            const queued = await runGraphQL(() => trigger({ question: asked, path, history }), {
                showSuccessToast: false,
            })
            if (queued === undefined) {
                fail()
                return
            }
            setGenerationId(queued.generationId)
        },
        [isAsking, messages, isManager, text, answer, fail, nextId, runGraphQL, trigger],
    )

    const restart = useCallback(() => {
        setMessages([])
        setGenerationId(undefined)
        setIsAsking(false)
    }, [])

    return { messages, isAsking, ask, restart }
}
