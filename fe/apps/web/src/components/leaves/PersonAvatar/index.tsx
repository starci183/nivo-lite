import { Avatar } from "@starci/grammar/common"
import type { AvatarSize } from "@starci/grammar/common"
import { withoutParentheses } from "@/modules/i18n"

/** What the avatar draws for one person. */
type PersonAvatarProps = {
    readonly name: string
    readonly src?: string | null | undefined
    /** A stable seed (the person's id): without a picture the avatar draws the generated mark of this seed instead of initials. */
    readonly seed?: string | undefined
    /** `xs` renders the grammar's smallest plate (`sm`, 32px): the grammar publishes no 24px avatar. */
    readonly size?: "xs" | "sm" | "md" | "lg" | undefined
}

const AVATAR_SIZE: Record<NonNullable<PersonAvatarProps["size"]>, AvatarSize> = {
    xs: "sm",
    sm: "sm",
    md: "md",
    lg: "lg",
}

/** A person's avatar: the picture, else Grammar's generated initials of the name (a bracketed note is not part of the name). */
export const PersonAvatar = (props: PersonAvatarProps) => (
    <Avatar
        name={withoutParentheses(props.name).trim()}
        {...(props.src ? { src: props.src } : {})}
        {...(props.seed === undefined ? {} : { seed: props.seed })}
        size={AVATAR_SIZE[props.size ?? "md"]}
    />
)
