import { useEffect, useState, useTransition } from "react"
import type { SetupWrite, WriteDecision } from "@/lib/module-setup-writes"
import type { DbOutcome } from "@/modules/db"
import { createBrowserDbClient } from "@/modules/db/browser"
import type { SetupMessage, SetupSession } from "@/modules/installations"
import { mergeMessages } from "./modules.shared"

/** What one turn of the chat answers: the session, the whole chat and the confirm cards as they are after it. */
type Turn = {
    readonly session: SetupSession
    readonly messages: Array<SetupMessage>
    readonly writes: Array<SetupWrite>
}

/** The commands of the chat the connected block passes in. */
type ChatCommands = {
    readonly post: (setupSessionId: string, text: string) => Promise<DbOutcome<Turn>>
    readonly decide: (writeId: string, change: WriteDecision) => Promise<DbOutcome<SetupWrite>>
}

/** What the chat starts from: what the server read. */
type ChatStart = {
    readonly session: SetupSession
    readonly messages: ReadonlyArray<SetupMessage>
    readonly writes: ReadonlyArray<SetupWrite>
}

/** What the chat hands the block. */
type SetupChat = {
    readonly session: SetupSession
    readonly setSession: (session: SetupSession) => void
    readonly messages: ReadonlyArray<SetupMessage>
    readonly writes: ReadonlyArray<SetupWrite>
    readonly text: string
    readonly setText: (text: string) => void
    readonly isSending: boolean
    /** Why the last message failed; empty otherwise. */
    readonly failure: string
    readonly send: () => void
    /** The owner confirms, edits or dismisses one card; resolves to the reason it failed, empty when it worked. */
    readonly decide: (id: string, change: WriteDecision) => Promise<string>
}

/**
 * The setup chat of an installation: the draft session, the messages (followed live, so the replies of NIVO and the other tabs of the
 * owner arrive) and the confirm cards. A new draft after an apply arrives through the server and replaces what is held.
 */
export const useSetupChat = (start: ChatStart, isLoading: boolean, commands: ChatCommands): SetupChat => {
    const [session, setSession] = useState(start.session)
    const [messages, setMessages] = useState<ReadonlyArray<SetupMessage>>(start.messages)
    const [writes, setWrites] = useState<ReadonlyArray<SetupWrite>>(start.writes)
    const [text, setText] = useState("")
    const [failure, setFailure] = useState("")
    const [isSending, startSending] = useTransition()

    useEffect(() => {
        setSession(start.session)
        setMessages(start.messages)
        setWrites(start.writes)
    }, [start.session, start.messages, start.writes])

    // Realtime: the replies of NIVO and the other tabs of the owner.
    useEffect(() => {
        if (isLoading) return undefined
        const client = createBrowserDbClient()
        const channel = client
            .channel(`module-setup-${session.id}`)
            .on(
                "postgres_changes",
                {
                    event: "INSERT",
                    schema: "public",
                    table: "module_setup_messages",
                    filter: `setup_session_id=eq.${session.id}`,
                },
                (payload) => {
                    const row = payload.new
                    if (typeof row.id !== "string" || typeof row.body !== "string") return
                    setMessages((current) =>
                        mergeMessages(current, [
                            {
                                id: row.id,
                                setupSessionId: session.id,
                                role: row.role === "user" ? "user" : "assistant",
                                author: typeof row.author === "string" ? row.author : "",
                                body: row.body,
                                createdAt: typeof row.created_at === "string" ? row.created_at : "",
                            },
                        ]),
                    )
                },
            )
            .subscribe()
        return () => {
            void client.removeChannel(channel)
        }
    }, [session.id, isLoading])

    const send = () => {
        const body = text.trim()
        if (body === "" || isSending) return
        setFailure("")
        setText("")
        startSending(async () => {
            const outcome = await commands.post(session.id, body)
            if (outcome.kind !== "ok") {
                setFailure(outcome.code)
                return
            }
            setSession(outcome.value.session)
            setMessages((current) => mergeMessages(current, outcome.value.messages))
            setWrites(outcome.value.writes)
        })
    }
    const decide = async (id: string, change: WriteDecision): Promise<string> => {
        const outcome = await commands.decide(id, change)
        if (outcome.kind !== "ok") return outcome.code
        setWrites((current) => current.map((write) => (write.id === id ? outcome.value : write)))
        return ""
    }
    return { session, setSession, messages, writes, text, setText, isSending, failure, send, decide }
}
