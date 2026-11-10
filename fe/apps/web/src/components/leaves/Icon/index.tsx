"use client"

import * as Outline from "@heroicons/react/24/outline"
import * as StarciOutline from "@starci/heroicons/24/outline"
import { Icon as GrammarIcon, Spinner } from "@starci/grammar/common"
import type { IconUsage } from "@starci/grammar/common"
import type { SVGProps, ReactElement } from "react"
import { GoogleMark } from "./component"
import type { IconName } from "./component"

export type { IconName } from "./component"
/** Every source in this registry is callable (Heroicons are forward-ref callables; custom marks are functions). */
type GlyphComponent = (props: SVGProps<SVGSVGElement>) => unknown

/** Native Heroicon drawings for the two product roles. */
type GlyphCuts = {
    readonly heading: GlyphComponent
    readonly leading: GlyphComponent
    readonly chip: GlyphComponent
}

/** Every cut is the outline drawing: the owner rule is outline icons only, never filled (2026-11-09). */
const cuts = (outline: GlyphComponent, chip: GlyphComponent): GlyphCuts => ({
    heading: outline,
    leading: outline,
    chip,
})

/** The app answer to "which glyph means this": every semantic name resolves to the cuts Grammar's Icon may ask for. */
const ICON_SOURCES: Readonly<Record<IconName, GlyphCuts>> = {
    moduleAccounting: cuts(Outline.DocumentTextIcon, Outline.DocumentTextIcon),
    moduleBooking: cuts(Outline.CalendarDaysIcon, Outline.CalendarDaysIcon),
    moduleChatbot: cuts(Outline.ChatBubbleLeftIcon, Outline.ChatBubbleLeftIcon),
    moduleContent: cuts(Outline.DocumentTextIcon, Outline.DocumentTextIcon),
    moduleHiring: cuts(Outline.BriefcaseIcon, Outline.BriefcaseIcon),
    moduleInventory: cuts(Outline.CubeIcon, Outline.CubeIcon),
    moduleLeadGen: cuts(Outline.FunnelIcon, Outline.FunnelIcon),
    moduleLoyalty: cuts(Outline.StarIcon, Outline.StarIcon),
    moduleSales: cuts(Outline.ArrowTrendingUpIcon, Outline.ArrowTrendingUpIcon),
    moduleShifts: cuts(Outline.CalendarDaysIcon, Outline.CalendarDaysIcon),
    moduleVideo: cuts(Outline.VideoCameraIcon, Outline.VideoCameraIcon),
    brand: cuts(Outline.AcademicCapIcon, Outline.AcademicCapIcon),
    streak: cuts(Outline.FireIcon, Outline.FireIcon),
    credit: cuts(Outline.BoltIcon, Outline.BoltIcon),
    reward: cuts(Outline.GiftIcon, Outline.GiftIcon),
    course: cuts(Outline.BookOpenIcon, Outline.BookOpenIcon),
    email: cuts(Outline.EnvelopeIcon, Outline.EnvelopeIcon),
    password: cuts(Outline.LockClosedIcon, Outline.LockClosedIcon),
    revealPassword: cuts(Outline.EyeIcon, Outline.EyeIcon),
    hidePassword: cuts(Outline.EyeSlashIcon, Outline.EyeSlashIcon),
    code: cuts(Outline.ShieldCheckIcon, Outline.ShieldCheckIcon),
    complete: cuts(Outline.CheckCircleIcon, Outline.CheckCircleIcon),
    pending: cuts(StarciOutline.CircleIcon, StarciOutline.CircleIcon),
    signIn: cuts(Outline.ArrowRightStartOnRectangleIcon, Outline.ArrowRightEndOnRectangleIcon),
    signOut: cuts(Outline.ArrowRightEndOnRectangleIcon, Outline.ArrowRightStartOnRectangleIcon),
    signUp: cuts(Outline.UserPlusIcon, Outline.UserPlusIcon),
    close: cuts(Outline.XMarkIcon, Outline.XMarkIcon),
    trash: cuts(Outline.TrashIcon, Outline.TrashIcon),
    next: cuts(Outline.ArrowRightIcon, Outline.ArrowRightIcon),
    brain: cuts(StarciOutline.BrainIcon, StarciOutline.BrainIcon),
    back: cuts(Outline.ArrowLeftIcon, Outline.ArrowLeftIcon),
    more: cuts(Outline.EllipsisHorizontalIcon, Outline.EllipsisHorizontalIcon),
    trigger: cuts(Outline.BoltIcon, Outline.BoltIcon),
    disclosure: cuts(Outline.ChevronRightIcon, Outline.ChevronRightIcon),
    edit: cuts(Outline.PencilSquareIcon, Outline.PencilSquareIcon),
    add: cuts(Outline.PlusIcon, Outline.PlusIcon),
    retry: cuts(Outline.ArrowPathIcon, Outline.ArrowPathIcon),
    send: cuts(Outline.PaperAirplaneIcon, Outline.PaperAirplaneIcon),
    attach: cuts(Outline.PaperClipIcon, Outline.PaperClipIcon),
    home: cuts(Outline.HomeIcon, Outline.HomeIcon),
    explore: cuts(Outline.GlobeAltIcon, Outline.GlobeAltIcon),
    community: cuts(Outline.UserGroupIcon, Outline.UserGroupIcon),
    league: cuts(Outline.TrophyIcon, Outline.TrophyIcon),
    review: cuts(Outline.ClipboardDocumentCheckIcon, Outline.ClipboardDocumentCheckIcon),
    light: cuts(Outline.SunIcon, Outline.SunIcon),
    dark: cuts(Outline.MoonIcon, Outline.MoonIcon),
    locale: cuts(Outline.LanguageIcon, Outline.LanguageIcon),
    search: cuts(Outline.MagnifyingGlassIcon, Outline.MagnifyingGlassIcon),
    filter: cuts(Outline.FunnelIcon, Outline.FunnelIcon),
    cart: cuts(Outline.ShoppingCartIcon, Outline.ShoppingCartIcon),
    notification: cuts(Outline.BellIcon, Outline.BellIcon),
    account: cuts(Outline.UserCircleIcon, Outline.UserCircleIcon),
    profile: cuts(Outline.IdentificationIcon, Outline.IdentificationIcon),
    saved: cuts(Outline.BookmarkIcon, Outline.BookmarkIcon),
    blog: cuts(Outline.NewspaperIcon, Outline.NewspaperIcon),
    talents: cuts(Outline.SparklesIcon, Outline.SparklesIcon),
    jobs: cuts(Outline.BriefcaseIcon, Outline.BriefcaseIcon),
    practice: cuts(Outline.CodeBracketIcon, Outline.CodeBracketIcon),
    overview: cuts(Outline.Squares2X2Icon, Outline.Squares2X2Icon),
    apps: cuts(Outline.WindowIcon, Outline.WindowIcon),
    agentos: cuts(Outline.CpuChipIcon, Outline.CpuChipIcon),
    servers: cuts(Outline.ServerStackIcon, Outline.ServerStackIcon),
    domains: cuts(Outline.GlobeAmericasIcon, Outline.GlobeAmericasIcon),
    wallet: cuts(Outline.WalletIcon, Outline.WalletIcon),
    support: cuts(Outline.LifebuoyIcon, Outline.LifebuoyIcon),
    sidebar: cuts(Outline.ViewColumnsIcon, Outline.ViewColumnsIcon),
    copy: cuts(Outline.DocumentDuplicateIcon, Outline.DocumentDuplicateIcon),
    copied: cuts(Outline.CheckIcon, Outline.CheckIcon),
    reply: cuts(Outline.ArrowUturnLeftIcon, Outline.ArrowUturnLeftIcon),
    mention: cuts(Outline.AtSymbolIcon, Outline.AtSymbolIcon),
    openLead: cuts(Outline.ArrowTopRightOnSquareIcon, Outline.ArrowTopRightOnSquareIcon),
    chat: cuts(Outline.ChatBubbleLeftRightIcon, Outline.ChatBubbleLeftRightIcon),
    menu: cuts(Outline.Bars3Icon, Outline.Bars3Icon),
    expand: cuts(Outline.ChevronDownIcon, Outline.ChevronDownIcon),
    collapseRail: cuts(Outline.ChevronDoubleLeftIcon, Outline.ChevronDoubleLeftIcon),
    google: cuts(GoogleMark, GoogleMark),
    device: cuts(Outline.ComputerDesktopIcon, Outline.ComputerDesktopIcon),
    phone: cuts(Outline.DevicePhoneMobileIcon, Outline.DevicePhoneMobileIcon),
    upload: cuts(Outline.ArrowUpTrayIcon, Outline.ArrowUpTrayIcon),
    muted: cuts(Outline.BellSlashIcon, Outline.BellSlashIcon),
    unmuted: cuts(Outline.BellIcon, Outline.BellIcon),
    history: cuts(Outline.ClockIcon, Outline.ClockIcon),
    messageSending: cuts(Outline.ClockIcon, Outline.ClockIcon),
    messageSent: cuts(Outline.CheckIcon, Outline.CheckIcon),
    messageDelivered: cuts(Outline.CheckCircleIcon, Outline.CheckCircleIcon),
    messageSeen: cuts(Outline.CheckIcon, Outline.CheckIcon),
    failure: cuts(Outline.XCircleIcon, Outline.XCircleIcon),
    warning: cuts(Outline.ExclamationTriangleIcon, Outline.ExclamationTriangleIcon),
    info: cuts(Outline.InformationCircleIcon, Outline.InformationCircleIcon),
    document: cuts(Outline.DocumentTextIcon, Outline.DocumentTextIcon),
    clock: cuts(Outline.ClockIcon, Outline.ClockIcon),
    remove: cuts(Outline.MinusIcon, Outline.MinusIcon),
    link: cuts(Outline.LinkIcon, Outline.LinkIcon),
    textNote: cuts(Outline.Bars3BottomLeftIcon, Outline.Bars3BottomLeftIcon),
    view: cuts(Outline.EyeIcon, Outline.EyeIcon),
    sparkle: cuts(Outline.SparklesIcon, Outline.SparklesIcon),
    handRaised: cuts(Outline.HandRaisedIcon, Outline.HandRaisedIcon),
    calendar: cuts(Outline.CalendarDaysIcon, Outline.CalendarDaysIcon),
    goal: cuts(Outline.ViewfinderCircleIcon, Outline.ViewfinderCircleIcon),
    play: cuts(Outline.PlayIcon, Outline.PlayIcon),
}

/** Resolve an app-owned semantic icon name to the glyph cut Grammar's Icon asks for in a given usage. */
export const nivoIconSource = (name: IconName, usage: IconUsage = "chip"): GlyphComponent => ICON_SOURCES[name][usage]

/** A client component reference lets the server console shell supply its drawer glyph without invoking client code. */
export const ConsoleDrawerIcon: GlyphComponent = ICON_SOURCES.more.leading

/** What the glyph draws: a meaning, never a component, so a Server Component caller crosses the boundary with a plain name. */
type IconProps = {
    readonly props: {
        readonly name: IconName
        readonly usage?: IconUsage
        readonly ariaLabel?: string
    }
}

/** The app glyph: resolves the meaning to its source already on the client side, where a function never needs to serialise. */
export const Icon = (props: IconProps): ReactElement => (
    <GrammarIcon
        source={nivoIconSource(props.props.name, props.props.usage)}
        {...(props.props.usage === undefined ? {} : { usage: props.props.usage })}
        {...(props.props.ariaLabel === undefined ? {} : { ariaLabel: props.props.ariaLabel })}
    />
)

/** The states a run or one of its steps can stand in. */
type RunMarkStatus = "queued" | "scheduled" | "running" | "waiting" | "done" | "failed" | "pending" | "undone" | "cancelled"

/** What the mark of a run or of a step says: where it stands, and the word that names it. */
type AgentRunStatusMarkProps = {
    readonly props: {
        readonly status: RunMarkStatus
        readonly label: string
    }
}

/** The glyph of each state that is not running, and the text colour its outline takes. */
const RUN_MARKS: Readonly<Record<Exclude<RunMarkStatus, "running">, { readonly icon: IconName; readonly colour: string }>> = {
    queued: { icon: "clock", colour: "text-muted" },
    scheduled: { icon: "calendar", colour: "text-muted" },
    waiting: { icon: "clock", colour: "text-warning" },
    done: { icon: "complete", colour: "text-success" },
    failed: { icon: "failure", colour: "text-danger" },
    pending: { icon: "pending", colour: "text-muted" },
    undone: { icon: "retry", colour: "text-muted" },
    cancelled: { icon: "remove", colour: "text-muted" },
}

/**
 * The mark of the state of a run or of a step, inline with its text: a spinner while it runs, else the OUTLINE glyph of its state coloured
 * by the state (check-circle success, x-circle danger, clock warning or muted), with no tile.
 */
export const AgentRunStatusMark = (props: AgentRunStatusMarkProps): ReactElement => {
    const { status, label } = props.props
    if (status === "running") return <Spinner label={label} size="sm" />
    const mark = RUN_MARKS[status]
    return (
        <span className={mark.colour}>
            <GrammarIcon source={nivoIconSource(mark.icon, "leading")} ariaLabel={label} />
        </span>
    )
}
