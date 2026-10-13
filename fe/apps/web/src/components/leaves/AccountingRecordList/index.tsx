import { Badge, EmptyNotice, ListRow, SurfaceListCard, Text, TextAction } from "@starci/grammar/common"
import { ROW_FACTS_CLASS_NAME } from "./classNames"

/** One status mark on a row. */
interface AccountingRecordBadge {
    readonly id: string
    readonly label: string
    readonly tone: "success" | "warning" | "neutral" | "accent"
    readonly isDot: boolean
}

/** One record of a list: who or what, a supporting line, up to two status marks, the amount and a footnote. */
interface AccountingRecord {
    readonly id: string
    readonly title: string
    readonly description: string
    readonly badges: ReadonlyArray<AccountingRecordBadge>
    readonly amount: string
    readonly footnote: string
}

/** A titled list of records with its empty state; a row opens its detail when the list is given a way to open it. */
interface AccountingRecordListProps {
    readonly label: string
    readonly empty: string
    readonly emptyBody: string
    readonly records: ReadonlyArray<AccountingRecord>
    readonly onOpen?: (id: string) => void
}

/** A collection of money records as rows: name, supporting line, status marks, amount and footnote. */
export const AccountingRecordList = (props: AccountingRecordListProps) => (
    <SurfaceListCard
        ariaLabel={props.label}
        empty={<EmptyNotice message={props.empty} description={props.emptyBody} />}
    >
        {props.records.map((record) => (
            <ListRow
                key={record.id}
                title={
                    props.onOpen === undefined ? (
                        record.title
                    ) : (
                        <TextAction onPress={() => props.onOpen?.(record.id)}>{record.title}</TextAction>
                    )
                }
                description={record.description}
                badges={
                    <>
                        {record.badges.map((badge) => (
                            <Badge key={badge.id} tone={badge.tone} isDot={badge.isDot}>
                                {badge.label}
                            </Badge>
                        ))}
                    </>
                }
            >
                <div className={ROW_FACTS_CLASS_NAME}>
                    <Text weight="semibold">{record.amount}</Text>
                    <Text size="xs" tone="muted">
                        {record.footnote}
                    </Text>
                </div>
            </ListRow>
        ))}
    </SurfaceListCard>
)
