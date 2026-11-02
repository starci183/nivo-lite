import { EmptyNotice, Section, Stack, Text, type ListRowData } from "@starci/grammar/common"
import type { SalesOrderRowView } from "@/modules/types"

/** The resolved collection of order-history records. */
interface SalesOrderRowsProps {
    readonly title: string
    readonly empty: string
    readonly rows: ReadonlyArray<SalesOrderRowView>
    readonly isLoading: boolean
}

/** Draws the original native records while the owning block controls pagination and read status. */
export const SalesOrderRows = (props: SalesOrderRowsProps) => (
    <Section
        kind="list"
        title={props.title}
        headingLevel={2}
        isLoading={props.isLoading}
        empty={<EmptyNotice message={props.empty} />}
        items={props.rows.map((row): ListRowData => ({
            id: row.id,
            title: row.number,
            description: row.items,
            badges: [{ label: row.status, tone: "neutral" }],
            ...(row.leadHref === null ? {} : { action: { label: row.number, href: row.leadHref } }),
            detail: (
                <Stack gap="identity">
                    <Text size="sm">{row.amount}</Text>
                    <Text size="xs" tone="muted">
                        {row.createdAt}
                    </Text>
                </Stack>
            ),
        }))}
    />
)
