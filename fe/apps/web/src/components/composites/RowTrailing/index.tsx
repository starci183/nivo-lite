import { Badge, Stack, Text } from "@starci/grammar/common"
import type { BadgeProps } from "@starci/grammar/common"
import { TRAILING_CLASS_NAME } from "./classNames"

/** What the end of a list row says: a muted meta line (a time, an owner) over one soft status chip. */
interface RowTrailingProps {
    readonly meta?: string
    readonly badge?: { readonly label: string; readonly tone: NonNullable<BadgeProps["tone"]> }
}

/** The trailing cell of a pane list row, the same everywhere: the meta line on top, the status chip under it, both at the end. */
export const RowTrailing = (props: RowTrailingProps) => (
    <div className={TRAILING_CLASS_NAME}>
        <Stack gap="identity" align="end">
            {props.meta === undefined ? null : (
                <Text size="xs" tone="muted">
                    {props.meta}
                </Text>
            )}
            {props.badge === undefined ? null : <Badge tone={props.badge.tone}>{props.badge.label}</Badge>}
        </Stack>
    </div>
)
