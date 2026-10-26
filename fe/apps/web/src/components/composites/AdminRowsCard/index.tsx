import { Button, EmptyNotice, ListRow, SurfaceListCard, Text } from "@starci/grammar/common"
import { AdminBadges } from "@/components/leaves/AdminBadges"
import type { AdminCardView, AdminRowView } from "@/hooks/admin"
import { ROW_META_CLASS_NAME } from "./classNames"

/** What a list card of the console draws. */
type AdminRowsCardProps = {
    readonly card: AdminCardView
}

/** What one row of the card draws. */
type RowProps = {
    readonly row: AdminRowView
}

const Row = (props: RowProps) => (
    <ListRow
        title={
            props.row.isMuted ? (
                <Text size="sm" tone="muted">
                    {props.row.title}
                </Text>
            ) : (
                props.row.title
            )
        }
        description={props.row.lines.length === 0 ? null : props.row.lines.join(" · ")}
        badges={<AdminBadges badges={props.row.badges} />}
        actions={
            props.row.link === undefined && props.row.note === undefined ? null : (
                <div className={ROW_META_CLASS_NAME}>
                    {props.row.link === undefined ? null : (
                        <Button size="sm" intent="neutral" href={props.row.link.href}>
                            {props.row.link.label}
                        </Button>
                    )}
                    {props.row.note === undefined ? null : (
                        <Text size="xs" tone="muted">
                            {props.row.note}
                        </Text>
                    )}
                </div>
            )
        }
    >
        {props.row.mono === undefined ? null : (
            <Text size="xs">
                <code>{props.row.mono}</code>
            </Text>
        )}
    </ListRow>
)

/** One list card of the console: its rows, or the empty notice when it has none. */
export const AdminRowsCard = (props: AdminRowsCardProps) => (
    <SurfaceListCard
        label={props.card.label}
        {...(props.card.ariaLabel === undefined ? {} : { ariaLabel: props.card.ariaLabel })}
        headingLevel={2}
        labelEnd={
            props.card.labelBadges.length === 0 ? undefined : (
                <div className={ROW_META_CLASS_NAME}>
                    <AdminBadges badges={props.card.labelBadges} />
                </div>
            )
        }
        empty={<EmptyNotice message={props.card.emptyMessage} />}
    >
        {props.card.rows.map((row) => (
            <Row key={row.id} row={row} />
        ))}
    </SurfaceListCard>
)
