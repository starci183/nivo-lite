import type { ReactNode } from "react"
import { Badge, EmptyNotice, Heading, List, SurfaceListCard, TextAction } from "@starci/grammar/common"
import { WorkbenchDecisionRow } from "@/components/branches/WorkbenchDecisionRow"
import type { WorkbenchRowView, WorkbenchSurface } from "@/modules/types"

/** One row of the list with its editor, which only the module knows how to draw. */
interface WorkbenchWaitingItem {
    readonly row: WorkbenchRowView
    readonly editor?: ReactNode
}

/** The waiting rows of a desk, and where they stand: a card on a card page, an app-owned list in a pane. */
export interface WorkbenchWaitingListProps {
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
}

/** The decisions waiting for a person, each decided in place (workbench section 4). */
export const WorkbenchWaitingList = (props: WorkbenchWaitingListProps) => {
    const rows = props.items.map((item) => (
        <WorkbenchDecisionRow
            key={item.row.id}
            row={item.row}
            editor={item.editor}
            seeWhyLabel={props.seeWhyLabel}
            moreLabel={props.moreLabel}
            isSkeleton={props.isSkeleton}
        />
    ))
    const more =
        props.more === null ? null : (
            <TextAction size="sm" href={props.more.href} isSkeleton={props.isSkeleton}>
                {props.more.label}
            </TextAction>
        )
    if (props.surface === "card") {
        return (
            <SurfaceListCard
                label={props.label}
                labelEnd={
                    props.count === null ? undefined : (
                        <Badge tone="warning" isDot isSkeleton={props.isSkeleton}>
                            {props.count}
                        </Badge>
                    )
                }
                empty={<EmptyNotice message={props.emptyMessage} description={props.emptyDescription} />}
                footer={more ?? undefined}
            >
                {rows}
            </SurfaceListCard>
        )
    }
    return (
        <>
            <Heading level={3}>{props.label}</Heading>
            {props.items.length === 0 ? (
                <EmptyNotice message={props.emptyMessage} description={props.emptyDescription} />
            ) : (
                <List label={props.label}>{rows}</List>
            )}
            {more}
        </>
    )
}
