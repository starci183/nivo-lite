import { Alert, Section } from "@starci/grammar/common"
import type { AskPassageView, BrainAskCopy } from "@/modules/types"

/** What the passages found for a question draw. */
interface AskPassagesProps {
    readonly passages: ReadonlyArray<AskPassageView>
    readonly copy: BrainAskCopy
}

/**
 * The passages the agent would read for the question, best first: the words, where each was read from, who may read it and how well it
 * matches. Nothing found says what the agent does then; it is one notice, not an empty table.
 */
export const AskPassages = (props: AskPassagesProps) => (
    <Section
        kind="list"
        title={props.copy.resultsTitle}
        meta={props.copy.resultsCount(props.passages.length)}
        headingLevel={2}
        items={props.passages.map((passage) => {
            const [first, second] = passage.chips
            return {
                id: passage.id,
                title: passage.text,
                description: passage.citation,
                ...(passage.href === null ? {} : { href: passage.href }),
                ...(first === undefined
                    ? {}
                    : { badges: second === undefined ? ([first] as const) : ([first, second] as const) }),
            }
        })}
        empty={<Alert tone="cautionary" title={props.copy.resultsEmpty} />}
    />
)
