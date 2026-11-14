import { SurfaceCard, type ListRowData } from "@starci/grammar/common"
import type { ReadinessPickView, ReadinessRowView } from "@/modules/types"

/** The words of the card. */
export interface WorkflowReadinessCardCopy {
    readonly title: string
}

/** What the card draws and what its commands do. */
interface WorkflowReadinessCardProps {
    readonly props: {
        readonly copy: WorkflowReadinessCardCopy
        /** The reasons; undefined while the list is read (the table beside it draws that loading and its failure). */
        readonly rows: ReadonlyArray<ReadinessRowView> | undefined
        /** False for anyone but the owner: the choice stays visible and its command is off. */
        readonly canPick: boolean
    }
    readonly on: { readonly pick: (pick: ReadinessPickView) => void }
}

/** The one next step of a row as the row's command: a link to the page that fixes it, or the choice in place. */
const actionOf = (row: ReadinessRowView, props: WorkflowReadinessCardProps): Pick<ListRowData, "action"> => {
    const next = row.next
    if (next === null) return {}
    if (next.kind === "link") return { action: { label: next.label, intent: "neutral", href: next.href } }
    return {
        action: {
            label: next.label,
            intent: "neutral",
            isDisabled: !props.props.canPick,
            press: () => props.on.pick(next.pick),
        },
    }
}

/** One reason as a row: the workflow's name over the reason, and the one next step at the end of the row (a neutral small command). */
const itemOf = (row: ReadinessRowView, props: WorkflowReadinessCardProps): ListRowData => ({
    id: row.id,
    title: row.workflowName,
    description: row.text,
    actionPlacement: "end",
    ...actionOf(row, props),
})

/**
 * Why the workflows that do not run cannot: one neutral list card on the page ground (an informative card is never red), a row per
 * reason with its one next step, a link to the page that fixes it or the choice to make in place. Nothing is drawn while every
 * workflow shows.
 */
export const WorkflowReadinessCard = (props: WorkflowReadinessCardProps) => {
    const { copy, rows } = props.props
    if (rows === undefined || rows.length === 0) return null
    return (
        <SurfaceCard
            kind="list"
            label={copy.title}
            headingLevel={2}
            count={rows.length}
            empty={null}
            items={rows.map((row) => itemOf(row, props))}
        />
    )
}
