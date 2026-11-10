import { Avatar, Badge } from "@starci/grammar/common"
import { CHANNEL_AVATAR_CLASS_NAME, CHANNEL_BADGE_CLASS_NAME } from "./classNames"

/** What the avatar of a customer says. */
interface ChannelAvatarProps {
    /** The name of the customer: the name of the avatar. */
    readonly name: string
    /** A stable seed (the customer id): the colour of the generated avatar. */
    readonly seed: string
    /** The short code of the channel the customer came in on ("Z", "TG"). */
    readonly badge: string
    /** The channel in words, for the accessible name. */
    readonly channelLabel: string
    readonly size?: "sm" | "md" | "lg"
    readonly isLoading?: boolean
}

/** A customer's avatar with the badge of the channel they came in on, named as one image: "Name, Channel". */
export const ChannelAvatar = (props: ChannelAvatarProps) => (
    <span className={CHANNEL_AVATAR_CLASS_NAME} role="img" aria-label={`${props.name}, ${props.channelLabel}`}>
        <Avatar
            name={props.name}
            seed={props.seed}
            size={props.size ?? "md"}
            isDecorative
            {...(props.isLoading === true ? { isLoading: true } : {})}
        />
        <span className={CHANNEL_BADGE_CLASS_NAME} aria-hidden="true">
            <Badge tone="accent">{props.badge}</Badge>
        </span>
    </span>
)
