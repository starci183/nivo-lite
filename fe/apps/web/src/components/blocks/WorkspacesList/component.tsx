import { SurfaceCard, type ErrorData, type ListRowData } from "@starci/grammar/common"

/** One workspace row, already worded for the person's language. */
export interface WorkspaceRowView {
    readonly id: string
    readonly name: string
    readonly roleLabel: string
    readonly stateLabel: string
    readonly stateTone: "success" | "warning" | "neutral"
    readonly actionLabel: string
    /** Opening is for people who can: the owner pays an unpaid workspace, nobody else opens it. */
    readonly canOpen: boolean
    readonly isOpening: boolean
    /** Where the billing link leads; none when the person manages no billing here. */
    readonly billingHref?: string | undefined
}

/** Copy and rows the connected workspace list supplies. */
export interface WorkspacesListBaseProps {
    readonly props: {
        readonly label: string
        readonly billingLabel: string
        readonly moreLabel: string
        readonly rows: ReadonlyArray<WorkspaceRowView>
        /** The first read has no data yet: the rows draw as skeleton under the real heading. */
        readonly isWaiting: boolean
        readonly error?: ErrorData | undefined
    }
    readonly on: { readonly open: (id: string) => void }
}

/** One resting row of the skeleton. */
const PLACEHOLDER_ROWS: ReadonlyArray<WorkspaceRowView> = ["a", "b", "c"].map((id) => ({
    id,
    name: "",
    roleLabel: "",
    stateLabel: "",
    stateTone: "neutral",
    actionLabel: "",
    canOpen: false,
    isOpening: false,
}))

/** The list card row of one workspace: the mark, the name over the role, the state, the way in, and the rare commands in a menu. */
const rowOf = (props: WorkspacesListBaseProps, row: WorkspaceRowView): ListRowData => ({
    id: row.id,
    title: row.name,
    description: row.roleLabel,
    leading: { avatar: { name: row.name } },
    badges: [{ label: row.stateLabel, tone: row.stateTone, isDot: true }],
    action: { label: row.actionLabel, intent: "neutral", isPending: row.isOpening, press: () => props.on.open(row.id) },
    ...(row.billingHref === undefined
        ? {}
        : {
              menu: {
                  label: props.props.moreLabel,
                  entries: [{ id: "billing", label: props.props.billingLabel, href: row.billingHref }],
              },
          }),
})

/** Draws the workspaces the person belongs to as one list card: a row each, with the count beside the heading. */
export const WorkspacesListBase = (props: WorkspacesListBaseProps) => {
    const rows = props.props.isWaiting ? PLACEHOLDER_ROWS : props.props.rows
    return (
        <SurfaceCard
            kind="list"
            label={props.props.label}
            {...(props.props.isWaiting ? {} : { fact: String(props.props.rows.length) })}
            items={rows.map((row) => rowOf(props, row))}
            empty={null}
            isLoading={props.props.isWaiting}
            {...(props.props.error === undefined ? {} : { error: props.props.error })}
        />
    )
}
