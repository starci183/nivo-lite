import { Badge } from "@starci/grammar/common"

/** Props of {@link ContentChannelBadges}. */
interface ContentChannelBadgesProps {
    /** The short names of the channels of a post. */
    readonly labels: ReadonlyArray<string>
}

/** The short names of the channels of a post. */
export const ContentChannelBadges = (props: ContentChannelBadgesProps) => (
    <>
        {props.labels.map((label) => (
            <Badge key={label} tone="neutral">
                {label}
            </Badge>
        ))}
    </>
)
