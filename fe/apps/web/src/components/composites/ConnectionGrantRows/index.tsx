import { EmptyNotice, Section, Select, SurfaceCard } from "@starci/grammar/common"
import type { ItemLeading, ListRowData } from "@starci/grammar/common"
import { nivoIconSource } from "@/components/leaves/Icon"

/** One pair of an agent and a connection: who or what the row names, and the level between them. */
interface ConnectionGrantRowData {
    readonly id: string
    readonly title: string
    readonly description?: string
    /** The mark: an agent's avatar on a connection's page, the connection's provider mark on an agent's page. */
    readonly leading: ItemLeading
    /** The accessible name of the level picker. */
    readonly levelLabel: string
    readonly level: string
}

/** The one "give" control: the choices that are not paired yet. */
interface ConnectionGrantAssign {
    readonly label: string
    readonly options: ReadonlyArray<{ readonly id: string; readonly label: string }>
    readonly onAssign: (id: string) => void
}

/** What the grant rows draw. */
interface ConnectionGrantRowsProps {
    readonly title: string
    readonly rows: ReadonlyArray<ConnectionGrantRowData>
    /** The picker's choices, the last of which removes the pair. */
    readonly levels: ReadonlyArray<{ readonly id: string; readonly label: string }>
    /** Only the owner changes a level or gives a connection. */
    readonly canManage: boolean
    readonly assign: ConnectionGrantAssign
    readonly emptyMessage: string
    readonly isLoading: boolean
    readonly onPick: (id: string, level: string) => void
    /** The rows stand on the page well as their own card (a connection page); else they are a section inside a surface. */
    readonly isCard?: boolean
}

/** What the rows need to draw their level pickers. */
interface PickerInput {
    readonly levels: ConnectionGrantRowsProps["levels"]
    readonly canManage: boolean
    readonly onPick: ConnectionGrantRowsProps["onPick"]
}

/** The list rows of the pairs, each with its level picker at the end of the row. */
const rowsOf = (rows: ReadonlyArray<ConnectionGrantRowData>, input: PickerInput): ReadonlyArray<ListRowData> =>
    rows.map((row) => ({
        id: row.id,
        title: row.title,
        ...(row.description === undefined ? {} : { description: row.description }),
        leading: row.leading,
        control: (
            <Select
                label={row.levelLabel}
                isLabelHidden
                options={input.levels}
                value={row.level}
                isDisabled={!input.canManage}
                onValueChange={(level) => {
                    if (level !== null && level !== row.level) input.onPick(row.id, level)
                }}
            />
        ),
    }))

/**
 * The pairs of agents and connections as rows, each with its level (read only, ask first, act, remove), and the one control that
 * gives another agent or connection. The same rows draw the agents of a connection on its page and the connections of an agent on
 * the agent's page, so both views look alike: agent and connection are many to many with one level per pair.
 */
export const ConnectionGrantRows = (props: ConnectionGrantRowsProps) => {
    const assign =
        props.canManage && props.assign.options.length > 0 ? (
            <Select
                label={props.assign.label}
                isLabelHidden
                placeholder={props.assign.label}
                options={props.assign.options}
                value={null}
                onValueChange={(id) => {
                    if (id !== null) props.assign.onAssign(id)
                }}
            />
        ) : undefined
    const items = rowsOf(props.rows, props)
    const empty = <EmptyNotice message={props.emptyMessage} iconSource={nivoIconSource("link", "leading")} />
    if (props.isCard === true) {
        return (
            <SurfaceCard
                kind="list"
                label={props.title}
                {...(props.isLoading ? {} : { count: props.rows.length })}
                {...(assign === undefined ? {} : { headers: [{ kind: "custom" as const, children: assign }] })}
                isLoading={props.isLoading}
                items={items}
                empty={empty}
            />
        )
    }
    return (
        <Section
            kind="list"
            title={props.title}
            {...(props.isLoading ? {} : { count: props.rows.length })}
            isLoading={props.isLoading}
            {...(assign === undefined ? {} : { filter: assign })}
            items={items}
            empty={empty}
        />
    )
}
