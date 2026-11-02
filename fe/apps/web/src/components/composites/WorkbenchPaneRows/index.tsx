import { EmptyNotice, Section } from "@starci/grammar/common"

/** One resolved line of the waiting or finished list inside a workbench pane. */
interface WorkbenchPaneRowsRow {
    readonly id: string
    readonly title: string
    readonly description: string
    readonly href: string
}

/** Plain list data and loading state; the owner keeps the independent data slot. */
interface WorkbenchPaneRowsProps {
    readonly label: string
    readonly rows: ReadonlyArray<WorkbenchPaneRowsRow>
    readonly openLabel: string | null
    readonly isLoading: boolean
}

/** A pane owns a Section list, with the same resolved row and link anatomy as the workbench. */
export const WorkbenchPaneRows = (props: WorkbenchPaneRowsProps) => (
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
