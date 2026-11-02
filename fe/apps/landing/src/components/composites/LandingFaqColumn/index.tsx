import { useState } from "react"
import { SurfaceCard, Text } from "@starci/grammar/common"

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
export const LandingFaqColumn = (props: LandingFaqColumnProps) => {
    const [openId, setOpenId] = useState(props.defaultOpenId)
    return (
        <SurfaceCard
            kind="accordion"
            ariaLabel={props.label}
            items={props.entries.map((entry) => ({
                id: entry.id,
                title: entry.question,
                body: <Text size="sm">{entry.answer}</Text>,
                isOpen: openId === entry.id,
            }))}
            onItemOpenChange={(id, isOpen) => setOpenId(isOpen ? id : undefined)}
        />
    )
}
