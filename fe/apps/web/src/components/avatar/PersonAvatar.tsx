"use client"

import {
    Avatar,
    IconTile,
    type AvatarSize,
    type IconSource,
    type IconSourceProps,
    type IconTileSize,
} from "@starci/grammar/common"
import { isModuleKey, moduleDef } from "@/lib/module-registry"
import { MARK, PRESENCE_DOT } from "./classNames"

/**
 * People: Grammar's `Avatar` (photo, or initials while it loads / when it fails). The old per-name colour palette was
 * raw colour and is gone; the initials sit on the neutral plate Grammar owns. The app keeps its own initials rule,
 * passed as the Avatar `fallback`.
 * grammar gap: `Avatar` publishes no `referrerPolicy`, so third-party photo hosts that refuse a referrer fall back to
 * the initials.
 */
export type PersonAvatarProps = {
    readonly name: string
    readonly src?: string | null
    /** `xs` renders Grammar's smallest plate (`sm`, 32px): Grammar publishes no 24px avatar. */
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
/** IconTile publishes `sm` (32px) and `md` (40px) only; `lg` takes `md`, `xs` takes `sm`. */
const TILE_SIZE: Record<NonNullable<PersonAvatarProps["size"]>, IconTileSize> = {
    xs: "sm",
    sm: "sm",
    md: "md",
    lg: "md",
}

/** "An Nguyen" → "AN", "Khách hàng A" → "KA", "demo" → "D". */
export const initialsOf = (name: string) => {
    // Only words that start with a letter count: "Anh Hùng (Facebook)" → "AH", not "A(".
    const words = name
        .replace(/\([^)]*\)/g, " ")
        .trim()
        .split(/\s+/)
        .filter((w) => /^\p{L}/u.test(w))
    if (words.length === 0) return "?"
    const first = words[0][0] ?? ""
    const last = words.length > 1 ? (words[words.length - 1][0] ?? "") : ""
    return (first + last).toLocaleUpperCase("vi")
}

const Presence = ({ online }: { readonly online?: boolean }) =>
    online ? <span className={PRESENCE_DOT} aria-hidden="true" /> : null

export const PersonAvatar = ({ name, src, size = "md", online }: PersonAvatarProps) => (
    <span className={MARK} title={name}>
        <Avatar name={name} src={src ?? undefined} fallback={initialsOf(name)} size={AVATAR_SIZE[size]} />
        <Presence online={online} />
    </span>
)

/** AI agents are a square tile with their module glyph, so a person (round Avatar) and an agent are never confused. */
export type AgentAvatarProps = {
    readonly module?: string
    readonly size?: "xs" | "sm" | "md" | "lg"
    readonly online?: boolean
    readonly label?: string
}

/** Each module's glyph lives in the registry (resources/modules/<key>/module.json); an unknown key falls back to the chatbot glyph. */
const glyphOf = (module: string): string => (isModuleKey(module) ? moduleDef(module).glyph : moduleDef("chatbot").glyph)

/** One stable app-owned glyph component per registry path (ICON-1: the app resolves the glyph, Grammar owns its box). */
const GLYPHS = new Map<string, IconSource>()
const glyphSource = (path: string): IconSource => {
    const cached = GLYPHS.get(path)
    if (cached) return cached
    const Glyph = (props: IconSourceProps) => (
        <svg viewBox="0 0 24 24" {...props}>
            <path
                d={path}
                fill="none"
                stroke="currentColor"
                strokeWidth="1.9"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </svg>
    )
    GLYPHS.set(path, Glyph)
    return Glyph
}

/**
 * Agent mark: Grammar's neutral `IconTile` (ACCENT-2: an identity tile spends no accent) instead of the hand-drawn
 * blush square with crimson glyph.
 */
export const AgentAvatar = ({ module = "chatbot", size = "md", online, label }: AgentAvatarProps) => (
    <span className={MARK} title={label} data-module={module}>
        <IconTile
            source={glyphSource(glyphOf(module))}
            tone="neutral"
            size={TILE_SIZE[size]}
            ariaLabel={label ?? `AI agent · ${module}`}
        />
        <Presence online={online} />
    </span>
)
