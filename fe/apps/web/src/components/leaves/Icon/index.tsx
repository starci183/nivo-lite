"use client"

import * as Outline from "@heroicons/react/24/outline"
import * as Solid from "@heroicons/react/16/solid"
import * as StarciSolid from "@starci/heroicons/16/solid"
import * as StarciOutline from "@starci/heroicons/24/outline"
import { Icon as GrammarIcon, IconTile } from "@starci/grammar/common"
import type { IconUsage } from "@starci/grammar/common"
import Image from "next/image"
import type { SVGProps } from "react"
import { GOOGLE_MARK } from "./classNames"

/** Every source in this registry is callable (Heroicons are forward-ref callables; custom marks are functions). */
type GlyphComponent = (props: SVGProps<SVGSVGElement>) => unknown

/**
 * The unfinished twin of Heroicons' 24px outline CheckCircleIcon. Heroicons does not export an
 * empty circle, so this keeps that glyph's outer path verbatim and removes only its inner check.
 */
const CircleIcon = (props: SVGProps<SVGSVGElement>) => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={1.5}
        stroke="currentColor"
        aria-hidden="true"
        data-slot="icon"
        {...props}
    >
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
    </svg>
)

/** Google's mark: a static asset, because the provider's own colours may not be redrawn as source colours. */
const GoogleMark = (props: SVGProps<SVGSVGElement>) => (
    <Image src="/brand/google-mark.svg" alt="" width={24} height={24} className={GOOGLE_MARK} aria-hidden="true" />
)

/** GitHub's mark, monochrome by specification, so it takes the row's own colour. */
const GithubMark = (input: SVGProps<SVGSVGElement>) => (
    <svg {...input} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M12 .5C5.65.5.5 5.74.5 12.22c0 5.18 3.29 9.58 7.86 11.14.58.11.79-.26.79-.57 0-.28-.01-1.02-.02-2-3.2.71-3.88-1.58-3.88-1.58-.52-1.36-1.28-1.72-1.28-1.72-1.04-.74.08-.73.08-.73 1.15.08 1.76 1.21 1.76 1.21 1.02 1.79 2.67 1.27 3.32.97.1-.76.4-1.27.73-1.56-2.56-.3-5.25-1.3-5.25-5.8 0-1.28.44-2.33 1.16-3.15-.12-.3-.51-1.5.11-3.12 0 0 .95-.31 3.11 1.2a10.49 10.49 0 0 1 5.66 0c2.16-1.5 3.11-1.2 3.11-1.2.62 1.62.23 2.82.11 3.12.72.82 1.16 1.87 1.16 3.15 0 4.51-2.7 5.5-5.26 5.79.41.36.77 1.08.77 2.18 0 1.57-.01 2.83-.01 3.21 0 .31.2.69.8.57 4.57-1.56 7.85-5.96 7.85-11.14C23.5 5.74 18.35.5 12 .5Z" />
    </svg>
)

/** Native Heroicon drawings for the two product roles. */
type GlyphCuts = { readonly heading: GlyphComponent; readonly leading: GlyphComponent; readonly chip: GlyphComponent }

/** Pair the normal and subject cuts without exposing either component to a caller. */
const cuts = (outline: GlyphComponent, chip: GlyphComponent): GlyphCuts => ({
    heading: outline,
    leading: outline,
    chip,
})

/** The app answer to "which glyph means this": every semantic name resolves to the cuts Grammar's Icon may ask for. */
const ICON_SOURCES = {
    brand: cuts(Outline.AcademicCapIcon, Solid.AcademicCapIcon),
    streak: cuts(Outline.FireIcon, Solid.FireIcon),
    credit: cuts(Outline.BoltIcon, Solid.BoltIcon),
    reward: cuts(Outline.GiftIcon, Solid.GiftIcon),
    course: cuts(Outline.BookOpenIcon, Solid.BookOpenIcon),
    email: cuts(Outline.EnvelopeIcon, Solid.EnvelopeIcon),
    password: cuts(Outline.LockClosedIcon, Solid.LockClosedIcon),
    revealPassword: cuts(Outline.EyeIcon, Solid.EyeIcon),
    hidePassword: cuts(Outline.EyeSlashIcon, Solid.EyeSlashIcon),
    code: cuts(Outline.ShieldCheckIcon, Solid.ShieldCheckIcon),
    complete: cuts(Outline.CheckCircleIcon, Solid.CheckCircleIcon),
    pending: cuts(CircleIcon, CircleIcon),
    signIn: cuts(Outline.ArrowRightStartOnRectangleIcon, Solid.ArrowRightEndOnRectangleIcon),
    signUp: cuts(Outline.UserPlusIcon, Solid.UserPlusIcon),
    close: cuts(Outline.XMarkIcon, Solid.XMarkIcon),
    trash: cuts(Outline.TrashIcon, Solid.TrashIcon),
    next: cuts(Outline.ArrowRightIcon, Solid.ArrowRightIcon),
    brain: cuts(StarciOutline.BrainIcon, StarciSolid.BrainIcon),
    back: cuts(Outline.ArrowLeftIcon, Solid.ArrowLeftIcon),
    more: cuts(Outline.EllipsisHorizontalIcon, Solid.EllipsisHorizontalIcon),
    trigger: cuts(Outline.BoltIcon, Solid.BoltIcon),
    disclosure: cuts(Outline.ChevronRightIcon, Solid.ChevronRightIcon),
    retry: cuts(Outline.ArrowPathIcon, Solid.ArrowPathIcon),
    send: cuts(Outline.PaperAirplaneIcon, Solid.PaperAirplaneIcon),
    home: cuts(Outline.HomeIcon, Solid.HomeIcon),
    explore: cuts(Outline.GlobeAltIcon, Solid.GlobeAltIcon),
    community: cuts(Outline.UserGroupIcon, Solid.UserGroupIcon),
    league: cuts(Outline.TrophyIcon, Solid.TrophyIcon),
    review: cuts(Outline.ClipboardDocumentCheckIcon, Solid.ClipboardDocumentCheckIcon),
    light: cuts(Outline.SunIcon, Solid.SunIcon),
    dark: cuts(Outline.MoonIcon, Solid.MoonIcon),
    locale: cuts(Outline.LanguageIcon, Solid.LanguageIcon),
    search: cuts(Outline.MagnifyingGlassIcon, Solid.MagnifyingGlassIcon),
    cart: cuts(Outline.ShoppingCartIcon, Solid.ShoppingCartIcon),
    notification: cuts(Outline.BellIcon, Solid.BellIcon),
    account: cuts(Outline.UserCircleIcon, Solid.UserCircleIcon),
    saved: cuts(Outline.BookmarkIcon, Solid.BookmarkIcon),
    blog: cuts(Outline.NewspaperIcon, Solid.NewspaperIcon),
    talents: cuts(Outline.SparklesIcon, Solid.SparklesIcon),
    jobs: cuts(Outline.BriefcaseIcon, Solid.BriefcaseIcon),
    practice: cuts(Outline.CodeBracketIcon, Solid.CodeBracketIcon),
    overview: cuts(Outline.Squares2X2Icon, Solid.Squares2X2Icon),
    apps: cuts(Outline.WindowIcon, Solid.WindowIcon),
    agentos: cuts(Outline.CpuChipIcon, Solid.CpuChipIcon),
    servers: cuts(Outline.ServerStackIcon, Solid.ServerStackIcon),
    domains: cuts(Outline.GlobeAmericasIcon, Solid.GlobeAmericasIcon),
    wallet: cuts(Outline.WalletIcon, Solid.WalletIcon),
    support: cuts(Outline.LifebuoyIcon, Solid.LifebuoyIcon),
    sidebar: cuts(Outline.ViewColumnsIcon, Solid.ViewColumnsIcon),
    copy: cuts(Outline.DocumentDuplicateIcon, Outline.DocumentDuplicateIcon),
    copied: cuts(Outline.CheckIcon, Outline.CheckIcon),
    google: cuts(GoogleMark, GoogleMark),
    github: cuts(GithubMark, GithubMark),
} satisfies Record<string, GlyphCuts>

/** What an icon MEANS on these screens. The glyph that draws it is this file business. */
export type IconName = keyof typeof ICON_SOURCES

/** Resolve an app-owned semantic icon name to the glyph cut Grammar's Icon asks for in a given usage. */
export const nivoIconSource = (name: IconName, usage: IconUsage = "chip") => ICON_SOURCES[name][usage]

/** What the glyph draws: a meaning, never a component, so a Server Component caller crosses the boundary with a plain name. */
type IconProps = {
    readonly props: {
        readonly name: IconName
        readonly usage?: IconUsage
        readonly ariaLabel?: string
    }
}

/** The app glyph: resolves the meaning to its source already on the client side, where a function never needs to serialise. */
export const Icon = (props: IconProps) => (
    <GrammarIcon
        source={nivoIconSource(props.props.name, props.props.usage)}
        usage={props.props.usage}
        ariaLabel={props.props.ariaLabel}
    />
)

/** A serialisable glyph name, so a server component can pass it. */
interface LandingIconTileProps {
    readonly name: IconName
}

/**
 * Neutral identity tile. The client boundary exists so a server component hands over a glyph NAME,
 * never a glyph function.
 */
export const LandingIconTile = (props: LandingIconTileProps) => (
    <IconTile source={nivoIconSource(props.name, "leading")} tone="neutral" size="sm" />
)
