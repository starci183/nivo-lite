import { Cluster, Stack, Text } from "@starci/grammar/common"
import type { ReactNode } from "react"

/** One flat field of a settings page: a title, an optional description, and its content or a control at the end of the title row. */
interface FieldBlockProps {
    /** The title: a short noun. */
    readonly title: string
    /** One muted line under the title; never a loose line elsewhere. */
    readonly description?: ReactNode
    /** A switch or a button at the right edge of the title row. */
    readonly trailing?: ReactNode
    /** The field's content (an input, a board, a picture), drawn under the title. */
    readonly children?: ReactNode
}

/**
 * Draws one field directly on the page ground, with no card and no divider: the title (14, weight 500) with its description (12, muted)
 * on the left of the title row and an optional switch or button on the right, then the content below.
 */
export const FieldBlock = (props: FieldBlockProps) => (
    <Stack gap="inline">
        <Cluster gap="inline" justify="between" wrap={false}>
            <Stack gap="identity">
                <Text isStrong>{props.title}</Text>
                {props.description === undefined ? null : (
                    <Text size="xs" tone="muted">
                        {props.description}
                    </Text>
                )}
            </Stack>
            {props.trailing}
        </Cluster>
        {props.children}
    </Stack>
)

/** The frame a slot's notices (error, forbidden, empty) sit in so the field keeps its title and description: pass it to `SlotView frame`. */
export const fieldFrameOf = (title: string, description: string) => (notice: ReactNode) => (
    <FieldBlock title={title} description={description}>
        {notice}
    </FieldBlock>
)
