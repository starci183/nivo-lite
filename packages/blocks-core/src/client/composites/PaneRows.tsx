import type { ReactNode } from "react"
import { EmptyNotice, Section } from "@starci/grammar/common"
import type { DashboardRow } from "../../views/views.types"

/** Plain list data and loading state; the block keeps the independent data slot. */
interface PaneRowsProps {
    readonly label: string
    readonly rows: ReadonlyArray<DashboardRow>
    readonly openLabel: string | null
    readonly isLoading: boolean
}

/** A pane owns a Section list, with the same resolved row and link anatomy as the dashboard. */
export const PaneRows = (props: PaneRowsProps): ReactNode => (
    <Section
        kind="list"
        title={props.label}
        headingLevel={3}
        isLoading={props.isLoading}
        items={props.rows.map((row) => ({
            id: row.id,
            title: row.title,
            description: row.description,
            ...(props.openLabel === null ? {} : { action: { label: props.openLabel, href: row.href } }),
        }))}
        empty={<EmptyNotice message={props.label} />}
    />
)
