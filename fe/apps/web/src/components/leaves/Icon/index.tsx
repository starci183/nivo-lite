"use client"

import * as Outline from "@heroicons/react/24/outline"
import * as Solid from "@heroicons/react/16/solid"
import * as StarciSolid from "@starci/heroicons/16/solid"
import * as StarciOutline from "@starci/heroicons/24/outline"
import { Icon as GrammarIcon } from "@starci/grammar/common"
import type { IconUsage } from "@starci/grammar/common"
import Image from "next/image"
import type { SVGProps } from "react"
import { GOOGLE_MARK } from "./classNames"

/** Every source in this registry is callable (Heroicons are forward-ref callables; custom marks are functions). */
type GlyphComponent = (props: SVGProps<SVGSVGElement>) => unknown

/**
 * Google's mark: a static asset, because the provider's own colours may not be redrawn as source colours. It still keeps
 * Grammar's A11Y-2 contract: named by the caller's label when the mark carries meaning, hidden when it is decorative.
 */
const GoogleMark = (props: SVGProps<SVGSVGElement>) => (
    <Image
        src="/brand/google-mark.svg"
        alt={props["aria-label"] ?? ""}
        width={24}
        height={24}
        className={GOOGLE_MARK}
        aria-hidden={props["aria-hidden"]}
    />
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
    moduleAccounting: cuts(Outline.DocumentTextIcon, Solid.DocumentTextIcon),
    moduleBooking: cuts(Outline.CalendarDaysIcon, Solid.CalendarDaysIcon),
    moduleChatbot: cuts(Outline.ChatBubbleLeftIcon, Solid.ChatBubbleLeftIcon),
    moduleContent: cuts(Outline.DocumentTextIcon, Solid.DocumentTextIcon),
    moduleHiring: cuts(Outline.BriefcaseIcon, Solid.BriefcaseIcon),
    moduleInventory: cuts(Outline.CubeIcon, Solid.CubeIcon),
    moduleLeadGen: cuts(Outline.FunnelIcon, Solid.FunnelIcon),
    moduleLoyalty: cuts(Outline.StarIcon, Solid.StarIcon),
    moduleSales: cuts(Outline.ArrowTrendingUpIcon, Solid.ArrowTrendingUpIcon),
    moduleShifts: cuts(Outline.CalendarDaysIcon, Solid.CalendarDaysIcon),
    moduleVideo: cuts(Outline.VideoCameraIcon, Solid.VideoCameraIcon),
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
    pending: cuts(StarciOutline.CircleIcon, StarciOutline.CircleIcon),
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
