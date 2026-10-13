import { Button, EmptyNotice, ListItem, SurfaceListCard, Text } from "@starci/grammar/common"
import { AdminBadges } from "@/components/leaves/AdminBadges"
import type { AdminCardView, AdminRowView } from "@/hooks/admin"
import { ROW_CLASS_NAME, ROW_MAIN_CLASS_NAME, ROW_META_CLASS_NAME } from "./classNames"

/** What a list card of the console draws. */
type AdminRowsCardProps = {
    readonly card: AdminCardView
}

/** What one row of the card draws. */
type RowProps = {
    readonly row: AdminRowView
}

const Row = (props: RowProps) => (
    <ListItem className={ROW_CLASS_NAME}>
        <div className={ROW_MAIN_CLASS_NAME}>
            {props.row.isMuted ? (
                <Text size="sm" tone="muted">
                    {props.row.title}
                </Text>
            ) : (
                <Text weight="medium">{props.row.title}</Text>
            )}
            {props.row.lines.map((line) => (
                <Text key={line} size="xs" tone="muted">
                    {line}
                </Text>
            ))}
            {props.row.mono === undefined ? null : (
                <Text size="xs">
                    <code>{props.row.mono}</code>
                </Text>
            )}
        </div>
        <div className={ROW_META_CLASS_NAME}>
            {props.row.link === undefined ? null : (
                <Button size="sm" variant="ghost" href={props.row.link.href}>
                    {props.row.link.label}
                </Button>
            )}
            {props.row.note === undefined ? null : (
                <Text size="xs" tone="muted">
                    {props.row.note}
                </Text>
            )}
            <AdminBadges badges={props.row.badges} />
        </div>
    </ListItem>
)

/** One list card of the console: its rows, or the empty notice when it has none. */
export const AdminRowsCard = (props: AdminRowsCardProps) => (
    <SurfaceListCard
        label={props.card.label}
        ariaLabel={props.card.ariaLabel}
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
