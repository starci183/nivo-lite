import { Avatar } from "@starci/grammar/common"
import type { AvatarSize } from "@starci/grammar/common"
import { MARK, PRESENCE_DOT } from "./classNames"

/** What the avatar draws for one person. */
type PersonAvatarProps = {
    readonly name: string
    readonly src?: string | null
    /** `xs` renders the grammar's smallest plate (`sm`, 32px): the grammar publishes no 24px avatar. */
    readonly size?: "xs" | "sm" | "md" | "lg"
    /** Small dot for "online / active". */
    readonly online?: boolean
}

const AVATAR_SIZE: Record<NonNullable<PersonAvatarProps["size"]>, AvatarSize> = {
    xs: "sm",
    sm: "sm",
    md: "md",
    lg: "lg",
}

/** The initials of a name: first and last word that start with a letter ("Ada Lovelace" gives "AL"). */
const initialsOf = (name: string): string => {
    // Only words that start with a letter count, and a bracketed note is dropped: "Ada L. (Facebook)" gives "AL".
    const words = name
        .replace(/\([^)]*\)/g, " ")
        .trim()
        .split(/\s+/)
        .filter((word) => /^\p{L}/u.test(word))
    if (words.length === 0) return "?"
    const first = words[0]?.[0] ?? ""
    const last = words.length > 1 ? (words[words.length - 1]?.[0] ?? "") : ""
    return (first + last).toLocaleUpperCase("vi")
}

/** A person: the grammar `Avatar` (photo, or the initials while it loads or fails) with an optional presence dot. */
export const PersonAvatar = (props: PersonAvatarProps) => (
    <span className={MARK} title={props.name}>
        <Avatar
            name={props.name}
            src={props.src ?? undefined}
            fallback={initialsOf(props.name)}
            size={AVATAR_SIZE[props.size ?? "md"]}
        />
        {props.online ? <span className={PRESENCE_DOT} aria-hidden="true" /> : null}
    </span>
)
