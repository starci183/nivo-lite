import {
    Button,
    EmptyNotice,
    Section,
    Select,
    SurfaceCard,
    type ItemLeading,
    type ListRowData,
} from "@starci/grammar/common"
import { nivoIconSource } from "@/components/leaves/Icon"

/** One binding of an agent and a connection: who or what the row names. */
interface ConnectionGrantRowData {
    readonly id: string
    readonly title: string
    readonly description?: string
    /** The mark: an agent's avatar on a connection's page. */
    readonly leading: ItemLeading
}

/** The one "give" control: the choices that are not bound yet. */
interface ConnectionGrantAssign {
    readonly label: string
    readonly options: ReadonlyArray<{ readonly id: string; readonly label: string }>
    readonly onAssign: (id: string) => void
}

/** What the grant rows draw. */
interface ConnectionGrantRowsProps {
    readonly title: string
    readonly rows: ReadonlyArray<ConnectionGrantRowData>
    /** The words of the command that unbinds a row. */
    readonly removeLabel: string
    /** Only the owner binds or unbinds. */
    readonly canManage: boolean
    readonly assign: ConnectionGrantAssign
    readonly emptyMessage: string
    readonly isLoading: boolean
    readonly onRemove: (id: string) => void
    /** The rows stand on the page well as their own card (a connection page); else they are a section inside a surface. */
    readonly isCard?: boolean
}

/** What the rows need to draw their unbind command. */
interface RemoveInput {
    readonly removeLabel: string
    readonly canManage: boolean
    readonly onRemove: ConnectionGrantRowsProps["onRemove"]
}

/** The list rows of the bindings; the owner's rows end with the command that unbinds them. */
const rowsOf = (rows: ReadonlyArray<ConnectionGrantRowData>, input: RemoveInput): ReadonlyArray<ListRowData> =>
    rows.map((row) => ({
        id: row.id,
        title: row.title,
        ...(row.description === undefined ? {} : { description: row.description }),
        leading: row.leading,
        ...(input.canManage
            ? {
                  control: (
                      <Button intent="neutral" size="sm" onPress={() => input.onRemove(row.id)}>
                          {input.removeLabel}
                      </Button>
                  ),
              }
            : {}),
    }))

/**
 * The agents bound to a connection as rows, and the one control that binds another. A binding has no level: the node's mode
 * (`auto | ask`) is chosen in the step, and detaching is the kill switch.
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
