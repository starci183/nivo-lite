import { Accordion, SurfaceCard, Text } from "@starci/grammar/common"

/** One question with its answer. */
interface LandingFaqEntry {
    readonly id: string
    readonly question: string
    readonly answer: string
}

/** One column of the FAQ: its name, its entries and the entry open at first. */
interface LandingFaqColumnProps {
    readonly label: string
    readonly entries: ReadonlyArray<LandingFaqEntry>
    readonly defaultOpenId?: string
}

/**
 * One column of the FAQ: a top-level card holding the grammar's unframed single-open accordion. The question is the
 * accordion's own trigger copy; no typography or colour class reaches into it.
 */
export const LandingFaqColumn = (props: LandingFaqColumnProps) => (
    <SurfaceCard ariaLabel={props.label}>
        <Accordion
            label={props.label}
            headingLevel={3}
            defaultExpandedIds={props.defaultOpenId === undefined ? [] : [props.defaultOpenId]}
            items={props.entries.map((entry) => ({
                id: entry.id,
                title: entry.question,
                content: <Text size="sm">{entry.answer}</Text>,
            }))}
        />
    </SurfaceCard>
)
