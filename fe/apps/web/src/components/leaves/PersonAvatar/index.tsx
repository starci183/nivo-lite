import { Avatar as DiceAvatar, Style } from "@dicebear/core"
import lorelei from "@dicebear/styles/lorelei.json" with { type: "json" }
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

/** The initials of a name: first and last word that start with a letter ("Ada Lovelace" gives "AL"). */
const initialsOf = (name: string): string => {
    // Only words that start with a letter count, and a bracketed note is dropped: "Ada L. (Facebook)" gives "AL".
    const words = withoutParentheses(name)
        .trim()
        .split(/\s+/)
        .filter((word) => /^\p{L}/u.test(word))
    if (words.length === 0) return "?"
    const first = words[0]?.[0] ?? ""
    const last = words.length > 1 ? (words.at(-1)?.[0] ?? "") : ""
    return (first + last).toLocaleUpperCase("vi")
}

/** One local style definition serves every generated mark; no request leaves the browser. */
const GENERATED_STYLE = new Style(lorelei)

/** The generated mark of a seed as a data address: the same seed always gives the same face. */
const generatedMarkOf = (seed: string): string => new DiceAvatar(GENERATED_STYLE, { seed }).toDataUri()

/** The picture prop to draw: the uploaded one, else the generated mark of the seed, else none (initials show). */
export const avatarPictureOf = (
    src: string | null | undefined,
    seed: string | undefined,
): { readonly src?: string } => {
    if (src !== null && src !== undefined && src !== "") return { src }
    return seed === undefined ? {} : { src: generatedMarkOf(seed) }
}

/** Displays a person's avatar with their initials as the fallback. */
export const PersonAvatar = (props: PersonAvatarProps) => (
    <Avatar
        name={props.name}
        {...avatarPictureOf(props.src, props.seed)}
        fallback={initialsOf(props.name)}
        size={AVATAR_SIZE[props.size ?? "md"]}
    />
)
