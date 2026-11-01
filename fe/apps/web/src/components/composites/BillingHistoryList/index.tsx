import { Badge, EmptyNotice, ListRow, SurfaceListCard, Text } from "@starci/grammar/common"

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
    }
}

/** Draws formatted payment history or transfer reviews with one row recipe. */
export const BillingHistoryList = (props: BillingHistoryListProps) => (
    <SurfaceListCard
        label={props.props.title}
        headingLevel={2}
        empty={<EmptyNotice message={props.props.empty} />}
        {...(props.props.description === undefined
            ? {}
            : {
                  footer: (
                      <Text size="sm" tone="muted">
                          {props.props.description}
                      </Text>
                  ),
              })}
    >
        {props.props.rows.map((row) => (
            <ListRow
                key={row.id}
                title={row.title}
                description={row.detail}
                badges={row.status ? <Badge tone={row.status.tone}>{row.status.label}</Badge> : undefined}
            >
                {row.content ? (
                    <Text size="sm">
                        <code>{row.content}</code>
                    </Text>
                ) : null}
            </ListRow>
        ))}
    </SurfaceListCard>
)
