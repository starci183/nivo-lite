import { Fragment, useEffect, useRef } from "react"
import { Alert, Badge, Button, Cluster, Divider, IconButton, MessageBubble, Stack, Text } from "@starci/grammar/common"
import { AgentMark } from "@/components/leaves/AgentMark"
import { ChatMessageFiles } from "@/components/leaves/ChatMessageFiles"
import { nivoIconSource } from "@/components/leaves/Icon"
import { PersonAvatar } from "@/components/leaves/PersonAvatar"
import type { TeamChatApprovalView, TeamChatMessageRow } from "@/modules/types"

/** The words of the cards and controls of a thread. */
export interface TeamChatMessagesCopy {
    readonly pin: string
    readonly unpin: string
    readonly pinned: string
    readonly report: string
    readonly approvalPending: string
    readonly approvalApproved: string
    readonly approvalRefused: string
    readonly approvalExpired: string
    readonly approve: string
    readonly refuse: string
    readonly olderLabel: string
    readonly openRun: string
    /** "by {name}" and "at {time}" are composed from these parts, because module words take no placeholders. */
    readonly decidedBy: string
}

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
    readonly onOlder: () => void
    readonly onPin: (messageId: string, pinned: boolean) => void
    readonly onDecide: (decisionId: string, verdict: "approved" | "refused") => void
}

/** The tone and words of a settled decision. */
const settledOf = (approval: TeamChatApprovalView, copy: TeamChatMessagesCopy) => {
    const by = approval.decidedBy === "" ? "" : ` ${copy.decidedBy} ${approval.decidedBy}`
    const at = approval.decidedAt === "" ? "" : ` ${approval.decidedAt}`
    if (approval.status === "approved") return { tone: "success" as const, text: `${copy.approvalApproved}${by}${at}` }
    if (approval.status === "refused") return { tone: "danger" as const, text: `${copy.approvalRefused}${by}${at}` }
    return { tone: "neutral" as const, text: copy.approvalExpired }
}

/** The approval card under a message: the two answers while it waits and the viewer may answer, else the outcome. */
/** What an approval card draws: the decision, the words, whether its answer is in flight, and the answer. */
interface ApprovalCardProps {
    readonly approval: TeamChatApprovalView
    readonly copy: TeamChatMessagesCopy
    readonly isDeciding: boolean
    readonly onDecide: TeamChatMessagesProps["onDecide"]
}

const ApprovalCard = (props: ApprovalCardProps) => {
    const { approval, copy } = props
    if (approval.status !== "pending") {
        const settled = settledOf(approval, copy)
        return <Badge tone={settled.tone}>{settled.text}</Badge>
    }
    if (!approval.canDecide) return <Badge tone="warning">{copy.approvalPending}</Badge>
    return (
        <Cluster gap="inline">
            <Button
                intent="commit"
                size="sm"
                isPending={props.isDeciding}
                onPress={() => props.onDecide(approval.decisionId, "approved")}
            >
                {copy.approve}
            </Button>
            <Button
                intent="neutral"
                size="sm"
                isDisabled={props.isDeciding}
                onPress={() => props.onDecide(approval.decisionId, "refused")}
            >
                {copy.refuse}
            </Button>
        </Cluster>
    )
}

/** What goes under a message body: its files, the approval card, nothing else. */
const footerOf = (row: TeamChatMessageRow, props: TeamChatMessagesProps) => {
    const hasFiles = row.files.length > 0
    if (!hasFiles && row.approval === null && row.reportHref === null) return undefined
    return (
        <Stack gap="inline">
            {hasFiles ? <ChatMessageFiles files={row.files} /> : null}
            {row.reportHref === null ? null : (
                <Cluster gap="inline">
                    <Button intent="neutral" size="sm" href={row.reportHref}>
                        {props.copy.openRun}
                    </Button>
                </Cluster>
            )}
            {row.approval === null ? null : (
                <ApprovalCard
                    approval={row.approval}
                    copy={props.copy}
                    isDeciding={props.decidingId === row.approval.decisionId}
                    onDecide={props.onDecide}
                />
            )}
        </Stack>
    )
}

/** The mark beside an incoming bubble: the agent's, or the person's own. */
const avatarOf = (row: TeamChatMessageRow) =>
    row.author?.kind === "agent" ? (
        <AgentMark label={row.authorName} seed={row.author.id} size="sm" />
    ) : (
        <PersonAvatar name={row.authorName} seed={row.author?.id} size="sm" />
    )

/** The thread of one room: day dividers, bubbles on both sides, centred system lines, report and approval cards. */
export const TeamChatMessages = (props: TeamChatMessagesProps) => {
    const endRef = useRef<HTMLDivElement>(null)
    const newestId = props.rows.at(-1)?.id
    useEffect(() => {
        endRef.current?.scrollIntoView({ block: "end" })
    }, [newestId])
    if (props.isLoading) return <MessageBubble isLoading hasAvatar />
    return (
        <Stack gap="row">
            {props.hasOlder ? (
                <Cluster gap="inline" justify="center">
                    <Button intent="neutral" size="sm" isPending={props.isLoadingOlder} onPress={props.onOlder}>
                        {props.copy.olderLabel}
                    </Button>
                </Cluster>
            ) : null}
            {props.rows.map((row) => {
                const day = row.dayLabel === null ? null : <Divider label={row.dayLabel} />
                if (row.kind === "system") {
                    return (
                        <Fragment key={row.id}>
                            {day}
                            <Cluster gap="inline" justify="center">
                                <Text size="xs" tone="muted">
                                    {row.body}
                                </Text>
                            </Cluster>
                        </Fragment>
                    )
                }
                const isOwn = row.side === "outgoing"
                return (
                    <Fragment key={row.id}>
                        {day}
                        <MessageBubble
                            id={`message-${row.id}`}
                            side={row.side}
                            author={isOwn ? undefined : row.authorName}
                            avatar={isOwn ? undefined : avatarOf(row)}
                            meta={row.timeLabel}
                            status={
                                row.kind === "report" || row.pinned ? (
                                    <Cluster gap="inline">
                                        {row.kind === "report" ? (
                                            <Badge tone="neutral">{props.copy.report}</Badge>
                                        ) : null}
                                        {row.pinned ? <Badge tone="neutral">{props.copy.pinned}</Badge> : null}
                                    </Cluster>
                                ) : undefined
                            }
                            actions={
                                <IconButton
                                    intent="neutral"
                                    source={nivoIconSource("saved", "leading")}
                                    label={row.pinned ? props.copy.unpin : props.copy.pin}
                                    onPress={() => props.onPin(row.id, row.pinned)}
                                />
                            }
                            footer={footerOf(row, props)}
                            body={row.body}
                        />
                    </Fragment>
                )
            })}
            {props.decideError === null ? null : <Alert tone="negative" title={props.decideError} />}
            <div ref={endRef} />
        </Stack>
    )
}
