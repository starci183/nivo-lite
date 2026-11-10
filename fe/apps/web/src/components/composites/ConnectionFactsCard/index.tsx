import { SurfaceCard } from "@starci/grammar/common"

/** One labelled fact of a connection: a term, its value and, when there is one, the note after it. */
interface ConnectionFactRow {
    readonly id: string
    readonly label: string
    readonly value: string
    readonly meta?: string
}

/** Fake rows of the same shape: the skeleton reuses the ready tree. */
export const CONNECTION_FACTS_PLACEHOLDER: ReadonlyArray<ConnectionFactRow> = ["a", "b", "c", "d"].map((id) => ({
    id,
    label: "-",
    value: "-",
}))

/** What the facts card of a connection page draws. */
interface ConnectionFactsCardProps {
    /** "Connection details", already in the reader's language. */
    readonly title: string
    readonly facts: ReadonlyArray<ConnectionFactRow>
    readonly isLoading: boolean
}

/** The connection's facts as term and value rows on one details card. */
export const ConnectionFactsCard = (props: ConnectionFactsCardProps) => (
    <SurfaceCard
        kind="details"
        label={props.title}
        isLoading={props.isLoading}
        items={props.facts.map((fact) => ({
            id: fact.id,
            term: fact.label,
            description: fact.meta === undefined ? fact.value : `${fact.value} · ${fact.meta}`,
        }))}
    />
)
