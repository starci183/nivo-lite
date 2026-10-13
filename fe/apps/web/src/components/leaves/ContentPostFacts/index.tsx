import { Badge, Text } from "@starci/grammar/common"
import type { PostView } from "@/hooks/content"
import { CHIPS_CLASS_NAME, FACTS_CLASS_NAME } from "./classNames"

/** Props of {@link ContentPostFacts}. */
interface ContentPostFactsProps {
    readonly post: PostView
    /** Whether to show the short brief. */
    readonly showBrief: boolean
    /** Whether to show the theme of the post. */
    readonly showPillar: boolean
    /** Said instead of the theme when the post has none. */
    readonly noPillar: string
}

/** The facts of a post under its title: when, the short brief, its channels and its theme. */
export const ContentPostFacts = (props: ContentPostFactsProps) => (
    <div className={FACTS_CLASS_NAME}>
        <Text size="xs" tone="muted">
            {props.post.when}
        </Text>
        {props.showBrief && props.post.brief ? (
            <Text size="sm" tone="muted" overflow="clamp-2">
                {props.post.brief}
            </Text>
        ) : null}
        <div className={CHIPS_CLASS_NAME}>
            {props.post.channels.map((label) => (
                <Badge key={label} tone="neutral">
                    {label}
                </Badge>
            ))}
            {props.showPillar ? (
                <Text size="xs" tone="muted">
                    {props.post.pillar ?? props.noPillar}
                </Text>
            ) : null}
        </div>
    </div>
)
