import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react"
import type { ActionHandle, BlockHost, ReadPage } from "@nivo-lite/agent-sdk/block"
import type { SpecText } from "@nivo-lite/agent-sdk/schema"
import { SlotView, useBlockHost, type DataSlot, type SlotLabels } from "@nivo-lite/agent-sdk/client"
import { PaneSection } from "@starci/grammar/common"
import type { inboxBlock } from "../../blocks/chatbot/inbox.block"
import { draftIssue } from "../../rows/chatbot/conversation-draft"
import { REPLY_MAX } from "../../rules/chatbot/reply"
import { slotWithPending } from "../../rows/chatbot/conversation-pending"
import { entriesOf, messagesOf } from "../../rows/chatbot/conversation"
import type { MessageRow } from "../../rows/chatbot/conversation.types"
import { threadViewOf, type ThreadClock, type ThreadWords } from "../../rows/chatbot/conversation-view"
import { contactOf } from "../../rows/chatbot/contact"
import { THREAD_LINE_FIELDS } from "../../rows/chatbot/inbox-fields"
import { recordsView } from "../../rows/rows"
import { derivedSlot, parsedSlot } from "../../slots/slots"
import type { RenderOf } from "../render-props"
import { ConversationComposer } from "./ConversationComposer"
import { ConversationHead, type ConversationContactToggle, type ConversationHeadAction } from "./ConversationHead"
import { ConversationThread, type ConversationOlder } from "./ConversationThread"
import { useBlockWords, useSlotLabels } from "../composites/useBlockWords"
import { useConversationSend, type ConversationSend } from "./useConversationSend"

/** The thread to draw and what the spec set for it. */
interface ConversationPaneProps {
    /** The thread whose messages are drawn. The pane is keyed by it, so a draft never moves to another thread. */
    readonly threadId: string
    readonly slots: RenderOf<typeof inboxBlock>["slots"]
    /** The control of the contact pane beside the thread. */
    readonly contact: ConversationContactToggle
    /** The approval card the spec placed in the inbox; null when it placed none. */
    readonly approval: ReactNode
}

/** What the skeleton of a thread draws instead of messages. */
const NO_MESSAGES: ReadonlyArray<MessageRow> = []

/** The actions of the head: the ones the spec bound and the viewer may run. */
const headActionsOf = (
    handles: ReadonlyArray<readonly [string, ActionHandle]>,
    run: (handle: ActionHandle) => void,
): ReadonlyArray<ConversationHeadAction> =>
    handles.flatMap(([id, handle]) =>
        handle.isAllowed ? [{ id, label: handle.label, isRunning: handle.isRunning, onPress: () => run(handle) }] : [],
    )

/** The notice of an action on the thread that did not go through. */
const actionFailed = (host: BlockHost, words: (text: SpecText) => string): void =>
    host.notify("danger", words({ key: "conversationActionFailed" }))

/** The time the thread is read at, in milliseconds: when it opened, then again whenever the window regains focus. */
const useReadingTime = (): number => {
    const [nowMs, setNowMs] = useState(() => Date.now())
    useEffect(() => {
        const refresh = (): void => setNowMs(Date.now())
        window.addEventListener("focus", refresh)
        return () => window.removeEventListener("focus", refresh)
    }, [])
    return nowMs
}

/** The thread keeps its newest message in view: the band scrolls down whenever the last message changes. */
const useScrolledToEnd = (endKey: string): RefObject<HTMLDivElement | null> => {
    const scrollRef = useRef<HTMLDivElement | null>(null)
    useEffect(() => {
        const band = scrollRef.current
        if (band !== null) band.scrollTo({ top: band.scrollHeight })
    }, [endKey])
    return scrollRef
}

/** The words of the thread that are not the messages, in the viewer's language. */
const useThreadWords = (): ThreadWords => {
    const words = useBlockWords()
    return {
        today: words({ key: "conversationToday" }),
        yesterday: words({ key: "conversationYesterday" }),
        delivery: {
            queued: words({ key: "conversationDeliveryQueued" }),
            sent: words({ key: "conversationDeliverySent" }),
            failed: words({ key: "conversationDeliveryFailed" }),
            unknown: words({ key: "conversationDeliveryUnknown" }),
        },
    }
}

/** The control that loads the messages before the first one drawn; null when there are no more. */
const olderOf = (page: ReadPage | null, words: (text: SpecText) => string): ConversationOlder | null =>
    !page?.hasMore
        ? null
        : {
              label: words({ key: page.failure ? "slotRetry" : "conversationOlder" }),
              isLoading: page.isLoadingMore,
              onLoad: page.loadMore,
          }

/** What the band of messages is given. */
interface ThreadBandProps {
    readonly label: string
    /** The words of the data states: what an empty thread says, and the retry. */
    readonly labels: SlotLabels
    readonly scrollRef: RefObject<HTMLDivElement | null>
    /** The messages, the sent ones that are not confirmed yet among them. */
    readonly thread: DataSlot<ReadonlyArray<MessageRow>>
    readonly clock: ThreadClock
    readonly threadWords: ThreadWords
    /** The keys of the messages that failed to send and offer a retry. */
    readonly retryable: ReadonlySet<string>
    readonly older: ConversationOlder | null
    /** Reads the messages again. */
    readonly onRetry: () => void
    readonly composer: ConversationSend
    /** The approval card of the reply the AI drafted, which stands under the messages. */
    readonly approval: ReactNode
}

/** The scrolling band of the thread: its messages in the states of the data, and the controls of the failed sends. */
const ThreadBand = (props: ThreadBandProps): ReactNode => {
    const words = useBlockWords()
    return (
        <PaneSection
            scroll={{ label: props.label, role: "log", tone: "background", align: "start", scrollRef: props.scrollRef }}
        >
            <SlotView
                slot={props.thread}
                labels={props.labels}
                placeholder={NO_MESSAGES}
                onRetry={props.onRetry}
                render={(rows, isLoading) => (
                    <ConversationThread
                        isLoading={isLoading}
                        entries={
                            isLoading
                                ? []
                                : threadViewOf(
                                      entriesOf(rows, props.clock.zone),
                                      props.threadWords,
                                      props.clock,
                                      props.retryable,
                                  )
                        }
                        older={props.older}
                        retryWords={{
                            retry: words({ key: "conversationRetry" }),
                            discard: words({ key: "conversationDiscard" }),
                        }}
                        onRetry={props.composer.retry}
                        onDiscard={props.composer.discard}
                    />
                )}
            />
            {props.approval}
        </PaneSection>
    )
}

/** The open thread: head, messages (kept while they refresh) and the composer, all in one pane. */
export const ConversationPane = (props: ConversationPaneProps): ReactNode => {
    const host = useBlockHost()
    const words = useBlockWords()
    const labels = useSlotLabels({ key: "inbox_thread_empty" })
    const threadWords = useThreadWords()
    const nowMs = useReadingTime()
    const { messages, send, handoff, release } = props.slots
    const serverRows = derivedSlot(parsedSlot(messages.slot, recordsView), (records) =>
        messagesOf(records, THREAD_LINE_FIELDS),
    )
    const lastId = "items" in serverRows ? (serverRows.items.at(-1)?.id ?? null) : null
    const composer = useConversationSend(props.threadId, send, REPLY_MAX, lastId)
    const thread = slotWithPending(serverRows, composer.pending)
    const retryable = new Set(composer.pending.map((entry) => entry.key))
    const scrollRef = useScrolledToEnd("items" in thread ? (thread.items.at(-1)?.id ?? "") : "")
    const runAction = (handle: ActionHandle): void => {
        handle
            .run({ id: props.threadId })
            .then((outcome) => {
                if (!outcome.ok) actionFailed(host, words)
            })
            .catch(() => actionFailed(host, words))
    }
    const issue = draftIssue(composer.draft, REPLY_MAX)
    const label = words({ key: "inbox_thread_label" })
    const clock = { locale: host.locale(), zone: undefined, nowMs }
    const older = olderOf(messages.page, words)
    const threadRecord = props.slots.thread.slot
    const contact = "items" in threadRecord ? contactOf(threadRecord.items, words({ key: "inbox_untitled" })) : null
    const isHeld = contact !== null && contact.handledBy !== ""
    return (
        <>
            <ConversationHead
                label={label}
                thread={
                    contact === null
                        ? null
                        : {
                              title: contact.name,
                              avatar: contact.avatar,
                              subtitle:
                                  contact.channelName === ""
                                      ? ""
                                      : `${words({ key: "inbox_channel_prefix" })} ${contact.channelName}`,
                          }
                }
                contact={props.contact}
                actions={headActionsOf([isHeld ? ["release", release] : ["handoff", handoff]], runAction)}
            />
            <ThreadBand
                label={label}
                labels={labels}
                scrollRef={scrollRef}
                thread={thread}
                clock={clock}
                threadWords={threadWords}
                retryable={retryable}
                older={older}
                onRetry={messages.retry}
                composer={composer}
                approval={props.approval}
            />
            <ConversationComposer
                label={words({ key: "conversationComposerLabel" })}
                placeholder={words({ key: "conversationComposerPlaceholder" })}
                sendLabel={send.label}
                lockedText={send.isAllowed && isHeld ? null : words({ key: "conversationLocked" })}
                draft={composer.draft}
                maxLength={REPLY_MAX}
                problem={issue === "tooLong" ? words({ key: "conversationTooLong" }) : null}
                isSending={send.isRunning}
                canSend={composer.canSend}
                onDraft={composer.setDraft}
                onSend={composer.send}
            />
        </>
    )
}
