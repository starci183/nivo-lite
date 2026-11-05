import { useEffect, useRef, useState } from "react"
import type { ReactNode, RefObject } from "react"
import type { ActionHandle, BlockHost, ReadPage } from "@nivo-lite/agent-sdk/block"
import type { SpecText } from "@nivo-lite/agent-sdk/schema"
import { SlotView, useBlockHost } from "@nivo-lite/agent-sdk/client"
import type { DataSlot, SlotLabels } from "@nivo-lite/agent-sdk/client"
import { Pane, PaneGrid, PaneSection } from "@starci/grammar/common"
import type { conversationBlock } from "../../blocks/conversation.block"
import { DEFAULT_MAX_LENGTH, draftIssue } from "../../rows/conversation-draft"
import { slotWithPending } from "../../rows/conversation-pending"
import { entriesOf, messagesOf } from "../../rows/conversation"
import type { MessageRow } from "../../rows/conversation.types"
import { threadViewOf } from "../../rows/conversation-view"
import type { ThreadClock, ThreadWords } from "../../rows/conversation-view"
import { recordsView } from "../../rows/rows"
import { derivedSlot, parsedSlot } from "../../slots/slots"
import type { RenderOf } from "../render-props"
import { ConversationComposer } from "./ConversationComposer"
import { ConversationHead } from "./ConversationHead"
import type { ConversationHeadAction } from "./ConversationHead"
import { ConversationThread } from "./ConversationThread"
import type { ConversationOlder } from "./ConversationThread"
import { useBlockWords, useSlotLabels } from "./useBlockWords"
import { useConversationSend } from "./useConversationSend"
import type { ConversationSend } from "./useConversationSend"

/** The thread to draw and what the spec set for it. */
interface ConversationPaneProps {
    /** The thread whose messages are drawn. The pane is keyed by it, so a draft never moves to another thread. */
    readonly threadId: string
    readonly props: RenderOf<typeof conversationBlock>["props"]
    readonly slots: RenderOf<typeof conversationBlock>["slots"]
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
}

/** The scrolling band of the thread: its messages in the states of the data, and the controls of the failed sends. */
const ThreadBand = (props: ThreadBandProps): ReactNode => {
    const words = useBlockWords()
    return (
        <PaneSection
            scroll={{ label: props.label, role: "log", tone: "background", align: "end", scrollRef: props.scrollRef }}
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
        </PaneSection>
    )
}

/** The open thread: head, messages (kept while they refresh) and the composer, all in one pane. */
export const ConversationPane = (props: ConversationPaneProps): ReactNode => {
    const host = useBlockHost()
    const words = useBlockWords()
    const labels = useSlotLabels(props.props.empty)
    const threadWords = useThreadWords()
    const [openedAt] = useState(() => Date.now())
    const { messages, send, handoff, close } = props.slots
    const maxLength = props.props.maxLength ?? DEFAULT_MAX_LENGTH
    const serverRows = derivedSlot(parsedSlot(messages.slot, recordsView), (records) =>
        messagesOf(records, props.props),
    )
    const lastId = "items" in serverRows ? (serverRows.items.at(-1)?.id ?? null) : null
    const composer = useConversationSend(props.threadId, send, maxLength, lastId)
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
    const issue = draftIssue(composer.draft, maxLength)
    const label = words(props.props.label)
    const clock = { locale: host.locale(), zone: undefined, nowMs: openedAt }
    const older = olderOf(messages.page, words)
    return (
        <PaneGrid label={label} areas={["thread"]} columns={["fill"]}>
            <Pane area="thread">
                <ConversationHead
                    label={label}
                    actions={headActionsOf(
                        [
                            ["handoff", handoff],
                            ["close", close],
                        ],
                        runAction,
                    )}
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
                />
                {props.props.composer ? (
                    <ConversationComposer
                        label={words({ key: "conversationComposerLabel" })}
                        placeholder={words({ key: "conversationComposerPlaceholder" })}
                        sendLabel={send.label}
                        lockedText={send.isAllowed ? null : words({ key: "conversationLocked" })}
                        draft={composer.draft}
                        maxLength={maxLength}
                        problem={issue === "tooLong" ? words({ key: "conversationTooLong" }) : null}
                        isSending={send.isRunning}
                        canSend={composer.canSend}
                        onDraft={composer.setDraft}
                        onSend={composer.send}
                    />
                ) : null}
            </Pane>
        </PaneGrid>
    )
}
