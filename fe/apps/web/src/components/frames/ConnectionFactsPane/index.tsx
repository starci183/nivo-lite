import { Section } from "@starci/grammar/common"

/** One health tile: a figure, its label and the line under it. */
interface FactTile {
    readonly id: string
    readonly label: string
    readonly value: string
    readonly meta?: string
}

/** The resolved tiles; the block's SlotView hands them and the loading flag. */
interface ConnectionFactsPaneProps {
    readonly label: string
    readonly facts: ReadonlyArray<FactTile>
    readonly isLoading: boolean
}

/** The health tiles of a provider page (figure, label, meta line). */
export const ConnectionFactsPane = (props: ConnectionFactsPaneProps) => (
    <Section
        kind="figures"
        ariaLabel={props.label}
        isLoading={props.isLoading}
        items={props.facts.map((fact) => ({
            id: fact.id,
            term: fact.label,
            value: fact.value,
            ...(fact.meta === undefined ? {} : { meta: fact.meta }),
        }))}
    />
)
