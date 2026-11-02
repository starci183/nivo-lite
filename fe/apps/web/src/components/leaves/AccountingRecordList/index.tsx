import { Cluster, EmptyNotice, Stack, SurfaceCard, Text, type ListRowData } from "@starci/grammar/common"

/** One operational status carried by a record. */
interface AccountingRecordBadge {
    readonly id: string
    readonly label: string
    readonly tone: "success" | "warning" | "neutral" | "accent"
    readonly isDot: boolean
}

/** The settled amount, source and status of one accounting record. */
interface AccountingRecord {
    readonly id: string
    readonly title: string
    readonly description: string
    readonly badges: ReadonlyArray<AccountingRecordBadge>
    readonly amount: string
    readonly footnote: string
}

/** The record rows of a bounded panel, with an optional command opening their details. */
interface AccountingRecordListProps {
    readonly label: string
    readonly empty: string
    readonly emptyBody: string
    readonly records: ReadonlyArray<AccountingRecord>
    readonly onOpen?: ((id: string) => void) | undefined
    readonly isLoading: boolean
}

/** Keeps opening a record as a native row command, with its amount and source in the detail. */
const accountingRecordItemOf = (
    record: AccountingRecord,
    isLoading: boolean,
    onOpen?: (id: string) => void,
): ListRowData => {
    const [status, exception, ...facts] = record.badges
    let badges: ListRowData["badges"]
    if (status !== undefined) badges = exception === undefined ? [status] : [status, exception]
    return {
        id: record.id,
        title: record.title,
        description: record.description,
        ...(badges === undefined ? {} : { badges }),
        ...(onOpen === undefined ? {} : { action: { label: record.title, press: () => onOpen(record.id) } }),
        detail: (
            <Stack gap="inline">
                {facts.map((fact) => (
                    <Text key={fact.id} size="xs" tone="muted" isLoading={isLoading}>
                        {fact.label}
                    </Text>
                ))}
                <Cluster gap="inline" align="baseline" justify="between">
                    <Text isStrong isLoading={isLoading}>
                        {record.amount}
                    </Text>
                    <Text size="xs" tone="muted" isLoading={isLoading}>
                        {record.footnote}
                    </Text>
                </Cluster>
            </Stack>
        ),
    }
}

/** The bounded record collection for callers that have no collection owner of their own. */
export const AccountingRecordList = (props: AccountingRecordListProps) => (
    <SurfaceCard
        kind="list"
        ariaLabel={props.label}
        isLoading={props.isLoading === true}
        empty={<EmptyNotice message={props.empty} description={props.emptyBody} />}
        items={props.records.map((record) => accountingRecordItemOf(record, props.isLoading, props.onOpen))}
    />
)
