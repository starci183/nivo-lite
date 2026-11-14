import type { ReactNode } from "react"
import { Badge, Button, Cluster, Stack, Text, type BadgeTone } from "@starci/grammar/common"
import type { AgentMessageIntent, AgentMessageRecord } from "../../agent-message/agent-message-item"
import type { AgentMessageState } from "@nivo-lite/agent-sdk/team-chat"
import type { AgentMessageWords } from "./agent-message-words"

/** The tone of the chip a state draws. */
export const STATE_TONES: Readonly<Record<AgentMessageState, BadgeTone>> = {
    waiting: "warning",
    approved: "success",
    sent: "success",
    rejected: "danger",
    failed: "danger",
    expired: "neutral",
}

/** The tone of the chip of a message that asks for nothing: a notice is good news, the rest is neutral. */
const INTENT_TONES: Readonly<Record<AgentMessageIntent, BadgeTone>> = {
    notify: "success",
    ask: "warning",
    approve: "warning",
    report: "neutral",
}

const SEPARATOR = " \u00b7 "

/** The meta line under the card: which agent said it and when. */
export const metaOf = (record: AgentMessageRecord): string =>
    [record.agent, record.at].filter((part) => part !== "").join(SEPARATOR)

/** The line of who gets the content and through which connection, when the agent wants to send something to a customer. */
export const outboundOf = (record: AgentMessageRecord, words: AgentMessageWords): string => {
    if (record.outbound === undefined) return ""
    const via = record.outbound.via === undefined ? "" : ` ${words.via} ${record.outbound.via.label}`
    return `${words.outboundTo} ${record.outbound.to}${via}`
}

/** What a reason of the why list reads as: its source word, its label and, when it has one, its quote. */
const reasonOf = (entry: AgentMessageRecord["why"][number], words: AgentMessageWords): string => {
    const source = entry.source === "rule" ? words.rule : words.evidence
    const quote = entry.quote === "" ? "" : `${SEPARATOR}${entry.quote}`
    return `${source}: ${entry.label}${quote}`
}

/** Why a person is asked: each piece of evidence and each rule, with its quote. */
interface WhyListProps {
    readonly record: AgentMessageRecord
    readonly words: AgentMessageWords
}

/** Why a person is asked: the evidence and the rules behind it, one line each. */
export const WhyList = (props: WhyListProps): ReactNode => {
    if (props.record.why.length === 0) return null
    return (
        <Stack gap="inline">
            <Text size="sm" tone="muted">
                {props.words.why}
            </Text>
            {props.record.why.map((entry) => (
                <Text key={`${entry.source}:${entry.label}`} size="sm">
                    {reasonOf(entry, props.words)}
                </Text>
            ))}
        </Stack>
    )
}

/** The fallback for a kind nobody registered: the summary line and the way to open the source. */
interface SummaryProps {
    readonly record: AgentMessageRecord
    readonly openDetail: string
}

/** The body of a message of a kind nobody registered: its summary and the way to open its source. */
export const Summary = (props: SummaryProps): ReactNode => (
    <Stack gap="inline">
        <Text size="sm">{props.record.summary}</Text>
        {props.record.detailHref === "" ? null : (
            <Cluster gap="identity">
                <Button endArrow intent="neutral" href={props.record.detailHref}>
                    {props.openDetail}
                </Button>
            </Cluster>
        )}
    </Stack>
)

/** The chip at the end of the head: the state of a message that asks, else what a notice or a report is for (when the host has a word for it). */
interface HeadChipProps {
    readonly intent: AgentMessageIntent
    readonly state: AgentMessageState | null
    readonly words: AgentMessageWords
}

/** The chip of the head: the state of a message that asks, else its intent in words. */
export const HeadChip = (props: HeadChipProps): ReactNode => {
    const word = props.state === null ? props.words.intents?.[props.intent] : props.words.states[props.state]
    if (word === undefined || word === "") return null
    const tone = props.state === null ? INTENT_TONES[props.intent] : STATE_TONES[props.state]
    return <Badge tone={tone}>{word}</Badge>
}
