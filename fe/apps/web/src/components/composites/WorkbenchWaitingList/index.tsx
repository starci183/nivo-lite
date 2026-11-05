import type { ReactNode } from "react"
import { EmptyNotice, Link, Section, SurfaceCard, type ListRowData } from "@starci/grammar/common"
import { WorkbenchDecisionRow } from "@/components/branches/WorkbenchDecisionRow"
import type { WorkbenchRowData, WorkbenchSurface } from "@/modules/types"

/** One row of the list with its editor, which only the module knows how to draw. */
interface WorkbenchWaitingItem {
    readonly row: WorkbenchRowData
    readonly editor?: ReactNode
}

/** The waiting rows of a desk, and where they stand: a card on a card page, an app-owned list in a pane. */
interface WorkbenchWaitingListProps {
    readonly surface: WorkbenchSurface
    readonly label: string
    /** The count beside the label; null when nothing waits. */
    readonly count: string | null
    readonly items: ReadonlyArray<WorkbenchWaitingItem>
    /** "N more", linking to the tab that holds the full list; null when every row is shown. */
    readonly more: { readonly label: string; readonly href: string } | null
    readonly emptyMessage: string
    readonly emptyDescription: string
    readonly seeWhyLabel: string
    readonly moreLabel: string
    readonly isSkeleton: boolean
    /** Resolves the actual command id through the connected owner's current row. */
    readonly onCommand: (rowId: string, commandId: string) => void
}

/** The decisions waiting for a person, each decided in place (workbench section 4). */
export const WorkbenchWaitingList = (props: WorkbenchWaitingListProps) => {
    const rows = props.items.map((item) =>
        workbenchDecisionItemOf({
            row: item.row,
            ...(item.editor === undefined ? {} : { editor: item.editor }),
            seeWhyLabel: props.seeWhyLabel,
            moreLabel: props.moreLabel,
            onCommand: props.onCommand,
        }),
    )
    const more = props.more === null ? null : <Link href={props.more.href}>{props.more.label}</Link>
    if (props.surface === "card") {
        // Nothing waits: the box is not drawn, so the desk never stacks an empty card.
        if (props.items.length === 0 && !props.isSkeleton) return null
        return (
            <SurfaceCard
                kind="list"
                label={props.count === null ? props.label : `${props.label} · ${props.count}`}
                footer={more ?? undefined}
                isLoading={props.isSkeleton}
                items={rows}
                empty={<EmptyNotice message={props.emptyMessage} description={props.emptyDescription} />}
            />
        )
    }
    return (
        <>
            <Section
                kind="list"
                title={props.label}
                headingLevel={3}
                isLoading={props.isSkeleton}
                items={rows}
                empty={<EmptyNotice message={props.emptyMessage} description={props.emptyDescription} />}
            />
            {more}
        </>
    )
}

interface WorkbenchDecisionItemProps {
    readonly row: WorkbenchRowData
    readonly editor?: ReactNode
    readonly seeWhyLabel: string
    readonly moreLabel: string
    readonly onCommand: (rowId: string, commandId: string) => void
}
/** The collection owns native row metadata; the branch owns the decision detail. */
const workbenchDecisionItemOf = (props: WorkbenchDecisionItemProps): ListRowData => {
    const row = props.row
    return {
        id: row.id,
        title: row.title,
        description: row.description,
        detail: <WorkbenchDecisionRow {...props} />,
    }
}
