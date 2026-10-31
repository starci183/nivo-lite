import { Button, Stack, Text } from "@starci/grammar/common"
import type { PostView } from "@/modules/types"
import { chipClassName } from "./classNames"

/** Props of {@link ContentPostChip}. */
interface ContentPostChipProps {
    /** The post. */
    readonly post: PostView
    /** Whether it can be dragged to another day. */
    readonly draggable: boolean
    /** Opens the post. */
    readonly onOpen: (id: string) => void
    /** A drag of the chip started. */
    readonly onDragStart: (id: string) => void
    /** The drag ended. */
    readonly onDragEnd: () => void
}

/**
 * A post as a small chip: its time and status above a button with its title. Grammar gap: Button publishes no drag source, so the
 * draggable frame around the button is app-owned.
 */
export const ContentPostChip = (props: ContentPostChipProps) => (
    <div
        draggable={props.draggable}
        onDragStart={(event) => {
            props.onDragStart(props.post.id)
            event.dataTransfer.effectAllowed = "move"
            event.dataTransfer.setData("text/plain", props.post.id)
        }}
        onDragEnd={props.onDragEnd}
        className={chipClassName(props.post.isSkipped)}
    >
        <Stack gap="identity">
            <Text size="xs" tone="muted">
                {props.post.time} · {props.post.statusLabel}
            </Text>
            <Button intent="dismiss" size="sm" width="fill" onPress={() => props.onOpen(props.post.id)}>
                {props.post.title}
            </Button>
        </Stack>
    </div>
)
