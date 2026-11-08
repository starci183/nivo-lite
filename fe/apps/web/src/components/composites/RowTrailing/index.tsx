import { Badge, Stack, Text, type BadgeProps } from "@starci/grammar/common"
import { TRAILING_CLASS_NAME } from "./classNames"

/** What the end of a list row says: a muted meta line (a time, an owner) and one soft status chip. */
interface RowTrailingProps {
    readonly meta?: string
    readonly badge?: { readonly label: string; readonly tone: NonNullable<BadgeProps["tone"]> }
    /** Which line leads: the meta over the chip (default), or the chip over the meta (leads, decisions). */
    readonly order?: "meta-first" | "badge-first"
}

/** The trailing cell of a pane list row, the same everywhere: the two lines stacked at the end of the row. */
export const RowTrailing = (props: RowTrailingProps) => {
    const meta =
        props.meta === undefined ? null : (
            <Text key="meta" size="xs" tone="muted">
                {props.meta}
            </Text>
        )
    const chip =
        props.badge === undefined ? null : (
            <Badge key="badge" tone={props.badge.tone}>
                {props.badge.label}
            </Badge>
        )
    return (
        <div className={TRAILING_CLASS_NAME}>
            <Stack gap="identity" align="end">
                {props.order === "badge-first" ? [chip, meta] : [meta, chip]}
            </Stack>
        </div>
    )
}
