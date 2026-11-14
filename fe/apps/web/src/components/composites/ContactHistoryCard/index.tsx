import type { ReactNode } from "react"
import { SlotView, type SlotLabels } from "@nivo-lite/agent-sdk/client"
import { Button, Cluster, Divider, Link, MessageBubble, Stack, SurfaceCard, Text } from "@starci/grammar/common"
import { ChatMessageFiles } from "@/components/leaves/ChatMessageFiles"
import { nivoIconSource } from "@/components/leaves/Icon"
import { ThreadOrderCard } from "@/components/branches/ThreadOrderCard"
import type {
    ContactHistoryLineView,
    ContactHistoryThread,
    ContactHistoryView,
    ContactHistoryVoice,
    ContactsPanesCopy,
} from "@/modules/types"

/** What the conversation card draws and does. */
interface ContactHistoryCardProps {
    readonly copy: Pick<
        ContactsPanesCopy,
        "historyTitle" | "historyTabsLabel" | "historyWorkbench" | "historyFooter" | "historyOlder"
    >
    readonly history: ContactHistoryView
    readonly labels: SlotLabels
    readonly on: {
        readonly selectTab: (key: string) => void
        readonly older: () => void
        readonly retry: () => void
    }
}

/** A line with no words yet, of the shape of a real one. */
const placeholderLine = (id: string, voice: ContactHistoryVoice): ContactHistoryLineView => ({
    id,
    voice,
    author: " ",
    time: " ",
    text: " ",
    files: [],
    order: null,
    separator: null,
})

/** The thread while it is read: two lines of the shape of real ones, so the card keeps its ready geometry and the tabs stay real. */
const PLACEHOLDER: ContactHistoryThread = {
    lines: [placeholderLine("line:person", "person"), placeholderLine("line:agent", "agent")],
    hasOlder: false,
    isLoadingOlder: false,
}

/** The line one bubble draws. */
interface LineViewProps {
    readonly line: ContactHistoryLineView
}

/** What stands under the words of a line: the order card it told (read only), then its files; nothing when it has neither. */
const footerOf = (line: ContactHistoryLineView): ReactNode => {
    if (line.order === null && line.files.length === 0) return undefined
    return (
        <Stack gap="inline">
            {line.order === null ? null : <ThreadOrderCard order={line.order} />}
            {line.files.length === 0 ? null : <ChatMessageFiles files={line.files} />}
        </Stack>
    )
}

/** One line as the Grammar's chat bubble: the person's and the agents' on the flat surface at the start, a member of the shop's own typed line in the accent fill at the end; "who · time" above it. */
const LineView = (props: LineViewProps) => {
    const { line } = props
    return (
        <Stack gap="row">
            {line.separator === null ? null : <Divider label={line.separator} />}
            <MessageBubble
                id={`line-${line.id}`}
                side={line.voice === "staff" ? "outgoing" : "incoming"}
                measure="wide"
                author={line.author}
                meta={line.time}
                body={line.text}
                footer={footerOf(line)}
            />
        </Stack>
    )
}

/** The thread the lines are drawn from. */
interface ThreadViewProps extends ContactHistoryCardProps {
    readonly thread: ContactHistoryThread
}

/** The lines of the thread, with the control that loads older ones above them. */
const ThreadView = (props: ThreadViewProps) => (
    <Stack gap="row">
        {props.thread.hasOlder ? (
            <Cluster gap="inline" justify="center">
                <Button intent="neutral" size="sm" isPending={props.thread.isLoadingOlder} onPress={props.on.older}>
                    {props.copy.historyOlder}
                </Button>
            </Cluster>
        ) : null}
        {props.thread.lines.map((line) => (
            <LineView key={line.id} line={line} />
        ))}
    </Stack>
)

/** What the card holds at the moment. */
interface ShellProps extends ContactHistoryCardProps {
    readonly count?: number
    readonly isLoading?: boolean
    /** What the body holds at the moment: the lines, a notice, or the shape of lines. */
    readonly body: ReactNode
}

/** The one card the block always draws: its label and count, the tabs that filter it, the body of the moment and the read-only footer. */
const Shell = (props: ShellProps) => (
    <SurfaceCard
        label={props.copy.historyTitle}
        headingLevel={2}
        {...(props.count === undefined ? {} : { count: props.count })}
        {...(props.history.workbenchHref === null
            ? {}
            : {
                  labelEnd: (
                      <Link variant="head" href={props.history.workbenchHref}>
                          {props.copy.historyWorkbench}
                      </Link>
                  ),
              })}
        headers={[
            {
                kind: "filter",
                label: props.copy.historyTabsLabel,
                items: props.history.tabs.map((tab) => ({ id: tab.key, label: tab.label })),
                selectedKey: props.history.selectedKey,
                onSelect: props.on.selectTab,
            },
        ]}
        footers={[
            {
                kind: "custom",
                children: (
                    <Text as="span" size="xs" tone="muted">
                        {props.copy.historyFooter}
                    </Text>
                ),
            },
        ]}
        {...(props.isLoading === true ? { isLoading: true } : {})}
    >
        {props.body}
    </SurfaceCard>
)

/** The thread to draw and whether it is still being read. */
interface ThreadShellProps extends ThreadViewProps {
    readonly isLoading: boolean
}

/**
 * The card with its thread. While the first read runs the tabs stay real and the lines are bubble geometry; the count is left out
 * while older lines wait (only the loaded lines are counted).
 */
const ThreadShell = (props: ThreadShellProps) => (
    <Shell
        {...props}
        isLoading={props.isLoading}
        {...(props.thread.hasOlder || props.isLoading ? {} : { count: props.thread.lines.length })}
        body={<ThreadView {...props} />}
    />
)

/**
 * The conversation with the person across every channel as one card: underline tabs (the filter of this block: every channel, then
 * one per channel the person is on), the thread by time with a day separator that names the channel on the every-channel tab, and a
 * read-only footer. Loading keeps the tabs and draws bubble geometry; a failed read and a conversation with nothing said yet are said
 * inside the card, the first with its retry.
 */
export const ContactHistoryCard = (props: ContactHistoryCardProps) => (
    <SlotView
        slot={props.history.thread}
        placeholder={PLACEHOLDER}
        labels={props.labels}
        onRetry={props.on.retry}
        emptyIconSource={nivoIconSource("moduleChatbot", "leading")}
        frame={(notice) => <Shell {...props} body={notice} />}
        render={(thread, isSkeleton) => <ThreadShell {...props} thread={thread} isLoading={isSkeleton} />}
    />
)
