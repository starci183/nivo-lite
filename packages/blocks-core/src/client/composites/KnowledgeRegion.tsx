import type { ReactNode } from "react"
import { EmptyNotice, Link, Section, SurfaceCard } from "@starci/grammar/common"
import type { ListRowData } from "@starci/grammar/common"
import type { KnowledgeRegionView } from "../../views/views.types"

/** Copy and view of the knowledge region; `isLoading` draws the same card with blank geometry while the data is read. */
interface KnowledgeRegionProps {
    readonly label: string
    readonly view: KnowledgeRegionView
    readonly isLoading: boolean
    /** Whether the region stands in a surface that already holds it: a section, not a card. */
    readonly isSection?: boolean
}

/** The rows of a region that says how much the agent reads: the documents with the facts approved, then the fact that waits. */
const summaryRowsOf = (view: KnowledgeRegionView): ReadonlyArray<ListRowData> => {
    const summary = view.summary
    if (summary === undefined) return []
    const documents: ListRowData = {
        id: "documents",
        title: summary.documentsLine,
        meta: { text: summary.factsLine },
    }
    return summary.blockerLine === null
        ? [documents]
        : [documents, { id: "blocker", title: summary.blockerLine, state: "cautionary" }]
}

/** The rows of a region that only says what each part holds. */
const partRowsOf = (view: KnowledgeRegionView): ReadonlyArray<ListRowData> => [
    { id: "public", title: view.publicTitle, description: view.publicDescription },
    { id: "internal", title: view.internalTitle, description: view.internalDescription },
]

/** What the agent can read: how many documents and approved facts, and the fact that waits for the owner; else its lens, public and internal. The open gaps stand in their own card. */
export const KnowledgeRegion = (props: KnowledgeRegionProps): ReactNode => {
    const items = props.view.summary === undefined ? partRowsOf(props.view) : summaryRowsOf(props.view)
    const empty = <EmptyNotice message={props.view.footer} />
    const link = (
        <Link variant="head" href={props.view.openHref}>
            {props.view.openLabel}
        </Link>
    )
    if (props.isSection === true)
        return (
            <Section
                kind="list"
                title={props.label}
                headingLevel={3}
                action={link}
                isLoading={props.isLoading}
                items={items}
                empty={empty}
            />
        )
    return (
        <SurfaceCard
            kind="list"
            label={props.label}
            labelEnd={link}
            isLoading={props.isLoading}
            items={items}
            empty={empty}
            note={props.view.footer}
        />
    )
}
