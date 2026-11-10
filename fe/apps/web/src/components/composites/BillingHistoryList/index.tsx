import { EmptyNotice, Section, Text, type ListRowData } from "@starci/grammar/common"
import { nivoIconSource } from "@/components/leaves/Icon"

/** A formatted payment or transfer-review row. */
export interface BillingHistoryRow {
    readonly id: string
    readonly title: string
    readonly detail: string
    readonly content?: string | undefined
    readonly status?: { readonly label: string; readonly tone: "success" | "warning" | "danger" | "neutral" }
}

interface BillingHistoryListProps {
    readonly props: {
        readonly title: string
        /** The line under the rows that says what the list is. */
        readonly description?: string
        readonly empty: string
        readonly rows: ReadonlyArray<BillingHistoryRow>
        /** The read has no data yet: the rows draw as geometry. */
        readonly isLoading?: boolean
    }
}

/** Draws formatted payment history or transfer reviews with one row recipe. */
export const BillingHistoryList = (props: BillingHistoryListProps) => (
    <Section
        kind="list"
        title={props.props.title}
        headingLevel={2}
        isLoading={props.props.isLoading === true}
        empty={<EmptyNotice message={props.props.empty} iconSource={nivoIconSource("history", "leading")} />}
        {...(props.props.description === undefined
            ? {}
            : { caption: props.props.description })}
        items={props.props.rows.map((row): ListRowData => ({
            id: row.id,
            title: row.title,
            description: row.detail,
            ...(row.status ? { badges: [row.status] } : {}),
            detail: row.content ? (
                <Text size="sm">
                    <code>{row.content}</code>
                </Text>
            ) : null,
        }))}
    />
)
