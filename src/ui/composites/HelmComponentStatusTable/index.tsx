import { Text, Badge, type BadgeTone } from "@starci/grammar/common";



/** One public-safe component row returned by a Helm status view. */
export type HelmComponentStatusRow = {
    readonly id: string
    readonly name: string
    readonly detail: string
    readonly kind: string
    readonly status: string
    readonly statusTone: BadgeTone
    readonly resources: string
}

/** Resolved release identity and component rows. */
export type HelmComponentStatusTableData = { readonly id: string; readonly rows: ReadonlyArray<HelmComponentStatusRow> }

/** Props for the Helm component status table. */
export type HelmComponentStatusTableProps = { readonly props: HelmComponentStatusTableData; readonly isLoading?: boolean }

/** Render safe component status rows, including stable loading placeholders. */
export const HelmComponentStatusTable = (props: HelmComponentStatusTableProps) => {
    const rows = props.isLoading ? [undefined, undefined, undefined] : props.props.rows
    return (
        <div>
            {rows.map((row, index) => (
                <div key={row?.id ?? `loading-${index}`}>
                    <div>
                        <Text weight="semibold" isSkeleton={props.isLoading}>{row?.name}</Text>
                        <Text size="xs" tone="muted" isSkeleton={props.isLoading}>{row?.detail}</Text>
                    </div>
                    <Badge tone="neutral" isSkeleton={props.isLoading}>{row?.kind}</Badge>
                    <Badge tone={row?.statusTone} isSkeleton={props.isLoading}>{row?.status}</Badge>
                    <Text size="xs" tone="muted" isSkeleton={props.isLoading}>{row?.resources}</Text>
                </div>
            ))}
        </div>
    )
}
