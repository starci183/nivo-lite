import { useEffect, useRef } from "react"
import type { ReactNode } from "react"
import type { ActionHandle } from "@nivo-lite/agent-sdk/block"
import { SlotView, useBlockHost } from "@nivo-lite/agent-sdk/client"
import { Pane, PaneGrid, PaneSection } from "@starci/grammar/common"
import type { conversationBlock } from "../../blocks/conversation.block"
import { DEFAULT_MAX_LENGTH, draftIssue } from "../../rows/conversation-draft"
import { slotWithPending } from "../../rows/conversation-pending"
import { entriesOf, messagesOf } from "../../rows/conversation"
import type { MessageRow } from "../../rows/conversation.types"
import { threadViewOf } from "../../rows/conversation-view"
import { recordsView } from "../../rows/rows"
import { derivedSlot, parsedSlot } from "../../slots/slots"
import type { RenderOf } from "../render-props"
import { ConversationComposer } from "./ConversationComposer"
import { ConversationHead } from "./ConversationHead"
import type { ConversationHeadAction } from "./ConversationHead"
import { ConversationThread } from "./ConversationThread"
import { useBlockWords, useSlotLabels } from "./useBlockWords"
import { useConversationSend } from "./useConversationSend"

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

/** The open thread: head, messages (kept while they refresh) and the composer, all in one pane. */
export const ConversationPane = (props: ConversationPaneProps): ReactNode => {
    const host = useBlockHost()
    const words = useBlockWords()
    const labels = useSlotLabels(props.props.empty)
    const { messages, send, handoff, close } = props.slots
    const maxLength = props.props.maxLength ?? DEFAULT_MAX_LENGTH
    const serverRows = derivedSlot(parsedSlot(messages.slot, recordsView), (records) =>
        messagesOf(records, props.props),
    )
    const lastId = "items" in serverRows ? (serverRows.items.at(-1)?.id ?? null) : null
    const composer = useConversationSend(props.threadId, send, maxLength, lastId)
    const thread = slotWithPending(serverRows, composer.pending)
    const retryable = new Set(composer.pending.map((entry) => entry.key))
    const scrollRef = useRef<HTMLDivElement | null>(null)
    const endKey = "items" in thread ? (thread.items.at(-1)?.id ?? "") : ""
    useEffect(() => {
        const band = scrollRef.current
        if (band !== null) band.scrollTo({ top: band.scrollHeight })
    }, [endKey])

    const runAction = (handle: ActionHandle): void => {
        const fail = (): void => host.notify("danger", words({ key: "conversationActionFailed" }))
        handle
            .run({ id: props.threadId })
            .then((outcome) => {
                if (!outcome.ok) fail()
            })
            .catch(fail)
    }
    const issue = draftIssue(composer.draft, maxLength)
    const label = words(props.props.label)
    const clock = { locale: host.locale(), zone: undefined, nowMs: Date.now() }
    const threadWords = {
        today: words({ key: "conversationToday" }),
        yesterday: words({ key: "conversationYesterday" }),
        delivery: {
            queued: words({ key: "conversationDeliveryQueued" }),
            sent: words({ key: "conversationDeliverySent" }),
            failed: words({ key: "conversationDeliveryFailed" }),
            unknown: words({ key: "conversationDeliveryUnknown" }),
        },
    }
    const page = messages.page
    const older =
        page === null || !page.hasMore
            ? null
            : {
                  label: words({ key: page.failure ? "slotRetry" : "conversationOlder" }),
                  isLoading: page.isLoadingMore,
                  onLoad: page.loadMore,
              }
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
                <PaneSection scroll={{ label, role: "log", tone: "background", align: "end", scrollRef }}>
                    <SlotView
                        slot={thread}
                        labels={labels}
                        placeholder={NO_MESSAGES}
                        onRetry={messages.retry}
                        render={(rows, isLoading) => (
                            <ConversationThread
                                isLoading={isLoading}
                                entries={
                                    isLoading
                                        ? []
                                        : threadViewOf(entriesOf(rows, clock.zone), threadWords, clock, retryable)
                                }
                                older={older}
                                retryWords={{
                                    retry: words({ key: "conversationRetry" }),
                                    discard: words({ key: "conversationDiscard" }),
                                }}
                                onRetry={composer.retry}
                                onDiscard={composer.discard}
                            />
                        )}
                    />
                </PaneSection>
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
