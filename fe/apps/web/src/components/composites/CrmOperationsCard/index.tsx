import { EmptyNotice, SurfaceCard } from "@starci/grammar/common"

/** One operation of a CRM's snapshot. */
interface CrmOperationRow {
    readonly id: string
    /** Its one name (`nivo.api.crm.nivoweb.get.prices`). */
    readonly title: string
    /** Its method and path in the document. */
    readonly description: string
    /** The state chip, when the row has one. */
    readonly badge?: { readonly label: string; readonly tone: "success" | "warning" | "muted" }
}

/** What the operations card draws. */
interface CrmOperationsCardProps {
    readonly label: string
    readonly rows: ReadonlyArray<CrmOperationRow>
    readonly empty: string
    readonly isLoading: boolean
    /** The outline rank of the label. */
    readonly headingLevel: 2 | 3
}

/** The operations of a CRM snapshot as one list card: the name, the method and path under it, and the state chip at the end. */
export const CrmOperationsCard = (props: CrmOperationsCardProps) => (
    <SurfaceCard
        kind="list"
        label={props.label}
        headingLevel={props.headingLevel}
        isLoading={props.isLoading}
        count={props.rows.length}
        empty={<EmptyNotice message={props.empty} />}
        items={props.rows.map((row) => ({
            id: row.id,
            title: row.title,
            description: row.description,
            ...(row.badge === undefined ? {} : { badges: [row.badge] as const }),
        }))}
    />
)
