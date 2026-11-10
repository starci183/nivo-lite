import type { ReactNode } from "react"
import { Disclosure, Stack, SurfaceCard } from "@starci/grammar/common"
import { messageFactGroupsOf, type MessageFactGroups } from "../../agent-message/agent-message-facts"
import type { MessageFact } from "../../agent-message/agent-message-kinds"
import type { AgentMessageWords } from "./agent-message-words"

/** A named set of facts drawn as rows. */
interface FactRowsProps {
    readonly label: string
    readonly facts: MessageFactGroups["worded"]
}

/** Label/value rows inside the card: a bordered list with full-width dividers (a surface in the surface), never a grey box. */
const FactRows = (props: FactRowsProps): ReactNode => (
    <SurfaceCard
        kind="list"
        layout="keyValue"
        ariaLabel={props.label}
        empty={null}
        items={props.facts.map((fact) => ({ id: fact.id, title: fact.name, value: fact.value }))}
    />
)

/** What the facts of a message are drawn from: the facts and the words of the card. */
interface AgentMessageFactsProps {
    readonly facts: ReadonlyArray<MessageFact>
    readonly words: AgentMessageWords
    /** The name of the list when the host gave no word for the details (the card's title). */
    readonly fallbackLabel: string
}

/**
 * The facts of a message, folded: the worded ones under the details fold as label/value rows, the technical ones (raw codes, ids) in a
 * second fold inside it. A host that gave no words for the folds gets the worded facts as rows and no technical fact at all: a raw value
 * is never drawn as content.
 */
export const AgentMessageFacts = (props: AgentMessageFactsProps): ReactNode => {
    const { worded, technical } = messageFactGroupsOf(props.facts)
    const folds = props.words.facts
    if (worded.length === 0 && (folds === undefined || technical.length === 0)) return null
    if (folds === undefined) return <FactRows label={props.fallbackLabel} facts={worded} />
    return (
        <Disclosure
            kind="quiet"
            title={folds.details}
            body={
                <Stack gap="inline">
                    {worded.length === 0 ? null : <FactRows label={folds.details} facts={worded} />}
                    {technical.length === 0 ? null : (
                        <Disclosure
                            kind="quiet"
                            title={folds.technical}
                            body={<FactRows label={folds.technical} facts={technical} />}
                        />
                    )}
                </Stack>
            }
        />
    )
}
