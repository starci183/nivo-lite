import { Fragment, useEffect, useRef, useState, type ReactNode } from "react"
import { Alert, Button, Cluster, Divider, MessageBubble, Stack } from "@starci/grammar/common"
import { ChatNoticeGroup } from "@/components/composites/ChatNoticeGroup"
import { ChatSystemLine } from "@/components/composites/ChatSystemLine"
import { TeamChatAgentCard } from "@/components/composites/TeamChatAgentCard"
import { TeamChatBubble } from "@/components/composites/TeamChatBubble"
import { TeamChatStopCard } from "@/components/composites/TeamChatStopCard"
import type { TeamChatMessageRow, TeamChatMessagesCopy, TeamChatStopHandlers } from "@/modules/types"
import { itemsOf } from "./items"

/** The messages of the open room and what a person may do with them. */
interface TeamChatMessagesProps {
    readonly rows: ReadonlyArray<TeamChatMessageRow>
    readonly copy: TeamChatMessagesCopy
    /** The messages are still loading: the thread draws waiting bubbles. */
    readonly isLoading: boolean
    /** Earlier messages exist: the control that loads them is drawn at the top. */
    readonly hasOlder: boolean
    readonly isLoadingOlder: boolean
    /** The decision whose answer is in flight, or null. */
    readonly decidingId: string | null
    /** Why the last answer did not settle a decision, or null. */
    readonly decideError: string | null
    /** Scroll to the newest message when it changes; a list in a drawer keeps its place. */
    readonly followsNewest: boolean
    readonly onOlder: () => void
    /** Pins a message; a thread with nothing to pin (the setup chat) draws no pin. */
    readonly onPin?: (messageId: string, pinned: boolean) => void
    readonly onDecide: (decisionId: string, verdict: "approved" | "refused") => void
    /** The typed stop cards of runs and what is done with them; a thread that has none (the setup chat) passes none and draws them inert. */
    readonly stops?: TeamChatStopHandlers
    /** React to, reply to and forward a message; a thread that cannot (the setup chat) passes none and draws no toolbar. */
    readonly onReact?: (messageId: string, emoji: string) => void
    readonly onReply?: (messageId: string) => void
    readonly onShare?: (messageId: string) => void
    /** Cards that stand under a message, by the id of the message (the proposals and confirm cards of the setup chat). */
    readonly under?: Readonly<Record<string, ReactNode>>
    /** What stands after the last message (a line about a turn in flight). */
    readonly trailing?: ReactNode
}

/** One message of the thread and what a person may do with it. */
interface MessageRowProps {
    readonly row: TeamChatMessageRow
    readonly copy: TeamChatMessagesCopy
    readonly decidingId: string | null
    readonly onPin: TeamChatMessagesProps["onPin"]
    readonly onDecide: TeamChatMessagesProps["onDecide"]
    readonly stops: TeamChatMessagesProps["stops"]
    readonly onReact: TeamChatMessagesProps["onReact"]
    readonly onReply: TeamChatMessagesProps["onReply"]
    readonly onShare: TeamChatMessagesProps["onShare"]
}

/** One message: a centred system line, a card of an agent, or a bubble of a person. */
const MessageRow = (props: MessageRowProps) => {
    const { row } = props
    if (row.kind === "system") {
        return <ChatSystemLine text={row.body} />
    }
    if (row.stop != null) {
        return (
            <TeamChatStopCard
                row={row}
                card={row.stop}
                copy={props.copy}
                stops={props.stops}
                onReact={props.onReact}
                onReply={props.onReply}
                onShare={props.onShare}
            />
        )
    }
    if (row.card !== null) {
        return (
            <TeamChatAgentCard
                row={row}
                copy={props.copy}
                isDeciding={row.approval !== null && props.decidingId === row.approval.decisionId}
                onPin={props.onPin}
                onDecide={props.onDecide}
                onReact={props.onReact}
                onReply={props.onReply}
                onShare={props.onShare}
            />
        )
    }
    return (
        <TeamChatBubble
            row={row}
            copy={props.copy}
            onPin={props.onPin}
            onReact={props.onReact}
            onReply={props.onReply}
            onShare={props.onShare}
        />
    )
}

const NOTICE_SEPARATOR = " \u00b7 "

interface NoticeRowProps extends MessageRowProps {
    readonly rows: ReadonlyArray<TeamChatMessageRow>
    readonly isOpen: boolean
    readonly onToggle: () => void
}

/** The folded row of a run of identical notices: the first words bold, the rest muted, the count with the times and the way to open them. */
const NoticeRow = (props: NoticeRowProps) => {
    const { row } = props
    const lastTime = props.rows.at(-1)?.timeLabel ?? row.timeLabel
    const cut = row.body.indexOf(NOTICE_SEPARATOR)
    return (
        <ChatNoticeGroup
            title={cut < 0 ? row.body : row.body.slice(0, cut)}
            detail={cut < 0 ? "" : row.body.slice(cut + NOTICE_SEPARATOR.length)}
            count={props.rows.length}
            span={row.timeLabel === lastTime ? row.timeLabel : `${row.timeLabel}\u2013${lastTime}`}
            openLabel={props.copy.noticeOpen ?? ""}
            closeLabel={props.copy.noticeClose ?? ""}
            isOpen={props.isOpen}
            onToggle={props.onToggle}
            repeats={props.rows.map((repeat) => (
                <MessageRow key={repeat.id} {...props} row={repeat} />
            ))}
        />
    )
}

/** The thread of one room: day dividers, bubbles on both sides, centred system lines, and the cards of the agents. */
export const TeamChatMessages = (props: TeamChatMessagesProps) => {
    const endRef = useRef<HTMLDivElement>(null)
    const [openIds, setOpenIds] = useState<ReadonlyArray<string>>([])
    const newestId = props.rows.at(-1)?.id
    const { followsNewest } = props
    useEffect(() => {
        if (followsNewest) endRef.current?.scrollIntoView({ block: "end" })
    }, [followsNewest, newestId])
    if (props.isLoading) return <MessageBubble isLoading hasAvatar />
    const shared = {
        copy: props.copy,
        decidingId: props.decidingId,
        onPin: props.onPin,
        onDecide: props.onDecide,
        stops: props.stops,
        onReact: props.onReact,
        onReply: props.onReply,
        onShare: props.onShare,
    }
    return (
        <Stack gap="row">
            {props.hasOlder ? (
                <Cluster gap="inline" justify="center">
                    <Button intent="neutral" size="sm" isPending={props.isLoadingOlder} onPress={props.onOlder}>
                        {props.copy.olderLabel}
                    </Button>
                </Cluster>
            ) : null}
            {itemsOf(props.rows, (props.copy.noticeOpen ?? "") !== "").map((item) => {
                const { first } = item
                return (
                    <Fragment key={first.id}>
                        {first.dayLabel === null ? null : <Divider label={first.dayLabel} />}
                        {item.rows.length === 1 ? (
                            <MessageRow row={first} {...shared} />
                        ) : (
                            <NoticeRow
                                {...shared}
                                row={first}
                                rows={item.rows}
                                isOpen={openIds.includes(first.id)}
                                onToggle={() =>
                                    setOpenIds((ids) =>
                                        ids.includes(first.id) ? ids.filter((id) => id !== first.id) : [...ids, first.id],
                                    )
                                }
                            />
                        )}
                        {props.under?.[first.id]}
                    </Fragment>
                )
            })}
            {props.decideError === null ? null : <Alert tone="negative" title={props.decideError} />}
            {props.trailing}
            <div ref={endRef} />
        </Stack>
    )
}
