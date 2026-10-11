import {
  AcademicCapIcon,
  ArrowPathIcon,
  ArrowRightIcon,
  ArrowRightStartOnRectangleIcon,
  BellIcon,
  BoltIcon,
  BookmarkIcon,
  BookOpenIcon,
  BriefcaseIcon,
  CheckCircleIcon,
  ChevronRightIcon,
  ClipboardDocumentCheckIcon,
  CodeBracketIcon,
  CpuChipIcon,
  EnvelopeIcon,
  EyeIcon,
  EyeSlashIcon,
  FireIcon,
  GiftIcon,
  GlobeAltIcon,
  GlobeAmericasIcon,
  HomeIcon,
  LanguageIcon,
  LockClosedIcon,
  MagnifyingGlassIcon,
  MoonIcon,
  NewspaperIcon,
  LifebuoyIcon,
  PaperAirplaneIcon,
  ShieldCheckIcon,
  ShoppingCartIcon,
  Squares2X2Icon,
  ServerStackIcon,
  SparklesIcon,
  SunIcon,
  TrophyIcon,
  UserCircleIcon,
  UserGroupIcon,
  UserPlusIcon,
  WalletIcon,
  WindowIcon,
  XMarkIcon } from
"@heroicons/react/24/outline";
import {
  AcademicCapIcon as AcademicCapSolidIcon,
  ArrowPathIcon as ArrowPathSolidIcon,
  ArrowRightIcon as ArrowRightSolidIcon,
  ArrowRightEndOnRectangleIcon as ArrowRightEndOnRectangleSolidIcon,
  BellIcon as BellSolidIcon,
  BoltIcon as BoltSolidIcon,
  BookmarkIcon as BookmarkSolidIcon,
  BookOpenIcon as BookOpenSolidIcon,
  BriefcaseIcon as BriefcaseSolidIcon,
  CheckCircleIcon as CheckCircleSolidIcon,
  ChevronRightIcon as ChevronRightSolidIcon,
  ClipboardDocumentCheckIcon as ClipboardDocumentCheckSolidIcon,
  CodeBracketIcon as CodeBracketSolidIcon,
  CpuChipIcon as CpuChipSolidIcon,
  EnvelopeIcon as EnvelopeSolidIcon,
  EyeIcon as EyeSolidIcon,
  EyeSlashIcon as EyeSlashSolidIcon,
  FireIcon as FireSolidIcon,
  GiftIcon as GiftSolidIcon,
  GlobeAltIcon as GlobeAltSolidIcon,
  GlobeAmericasIcon as GlobeAmericasSolidIcon,
  HomeIcon as HomeSolidIcon,
  LanguageIcon as LanguageSolidIcon,
  LockClosedIcon as LockClosedSolidIcon,
  MagnifyingGlassIcon as MagnifyingGlassSolidIcon,
  MoonIcon as MoonSolidIcon,
  NewspaperIcon as NewspaperSolidIcon,
  LifebuoyIcon as LifebuoySolidIcon,
  PaperAirplaneIcon as PaperAirplaneSolidIcon,
  ShieldCheckIcon as ShieldCheckSolidIcon,
  ShoppingCartIcon as ShoppingCartSolidIcon,
  Squares2X2Icon as Squares2X2SolidIcon,
  ServerStackIcon as ServerStackSolidIcon,
  SparklesIcon as SparklesSolidIcon,
  SunIcon as SunSolidIcon,
  TrophyIcon as TrophySolidIcon,
  UserCircleIcon as UserCircleSolidIcon,
  UserGroupIcon as UserGroupSolidIcon,
  UserPlusIcon as UserPlusSolidIcon,
  WalletIcon as WalletSolidIcon,
  WindowIcon as WindowSolidIcon,
  XMarkIcon as XMarkSolidIcon } from
"@heroicons/react/16/solid";
import type { IconUsage } from "@starci/grammar/common";
import type { SVGProps } from "react";
import { GithubMark, GoogleMark } from "./product-brands";

/**
 * LEAF - `Icon`: the picture a word needs when the word alone is slower to find.
 *
 * WHY A NAME AND NOT A COMPONENT. A caller passing `<FireIcon />` decides three things at the call
 * site - which library, which glyph, how big - and the first screen to answer them differently is
 * the screen where the streak stops looking like the streak. Here the caller names the MEANING and
 * this file owns the glyph.
 *
 * WHY THE SET IS CLOSED. Heroicons ships a large glyph catalogue, and a product that can reach all
 * of them has no iconography, it has a search box.
 * `src/iconography.md` is the canonical feature-to-glyph table: read it before adding a meaning
 * or choosing a nearby glyph, and update it in the same change as this map.
 *
 * COLOUR IS NOT A PROP. The glyph draws in `currentColor`, so it inherits whatever `text-*` the
 * node above carries and can never disagree with the label beside it.
 */

/** What an icon MEANS on these screens. The glyph that draws it is this file's business. */
export type IconName =
"brand" | "streak" | "credit" | "reward" | "course" |
"email" | "password" | "revealPassword" | "hidePassword" | "code" |
"complete" | "pending" | "signIn" | "signUp" | "close" | "next" | "disclosure" | "retry" | "send" |
"home" | "explore" | "community" | "league" | "review" |
"light" | "dark" | "locale" | "google" | "github" |
"search" | "cart" | "notification" | "account" | "saved" | "blog" | "talents" | "jobs" | "practice" |
"overview" | "apps" | "agentos" | "servers" | "domains" | "wallet" | "support" | "sidebar";

/**
 * The meaning-to-glyph map. The only file in the repository that names a Heroicon.
 *
 * Two entries are NOT Heroicons: a provider mark has to be the provider own, in its own colours,
 * because that is what a reader recognises before they read anything.
 */
/** Every source in this registry is callable (Heroicons are forward-ref callables; custom marks are functions). */
type GlyphComponent = (props: SVGProps<SVGSVGElement>) => unknown;

/**
 * The unfinished twin of Heroicons' 24px outline CheckCircleIcon. Heroicons does not export an
 * empty circle, so this keeps that glyph's outer path verbatim and removes only its inner check.
 */
const CircleIcon = (props: SVGProps<SVGSVGElement>) =>
<svg
  xmlns="http://www.w3.org/2000/svg"
  fill="none"
  viewBox="0 0 24 24"
  strokeWidth={1.5}
  stroke="currentColor"
  aria-hidden="true"
  data-slot="icon"
  {...props}>
  
        <path
    strokeLinecap="round"
    strokeLinejoin="round"
    d="M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
  
    </svg>;


/** The exact regular Phosphor SidebarSimple drawing used by the StarCi rail owner. */
const SidebarSimpleIcon = (props: SVGProps<SVGSVGElement>) =>
<svg
  xmlns="http://www.w3.org/2000/svg"
  viewBox="0 0 256 256"
  fill="currentColor"
  aria-hidden="true"
  data-slot="icon"
  {...props}>
  
        <path d="M216,40H40A16,16,0,0,0,24,56V200a16,16,0,0,0,16,16H216a16,16,0,0,0,16-16V56A16,16,0,0,0,216,40ZM40,56H80V200H40ZM216,200H96V56H216V200Z" />
    </svg>;


/** Native Heroicon drawings for the two product roles. */
type GlyphCuts = {readonly heading: GlyphComponent;readonly leading: GlyphComponent;readonly chip: GlyphComponent;};

/** Pair the normal and subject cuts without exposing either component to a caller. */
const cuts = (outline: GlyphComponent, chip: GlyphComponent): GlyphCuts => ({
  heading: outline,
  leading: outline,
  chip
});

/**
 * The app's answer to "which glyph means this". Every Nivo semantic icon name resolves here to the
 * three cuts Grammar's `Icon` may ask for, so a screen names a MEANING and never a glyph library.
 */
export const ICON_SOURCES: Record<IconName, GlyphCuts> = {
  brand: cuts(AcademicCapIcon, AcademicCapSolidIcon),
  streak: cuts(FireIcon, FireSolidIcon),
  credit: cuts(BoltIcon, BoltSolidIcon),
  reward: cuts(GiftIcon, GiftSolidIcon),
  course: cuts(BookOpenIcon, BookOpenSolidIcon),
  email: cuts(EnvelopeIcon, EnvelopeSolidIcon),
  password: cuts(LockClosedIcon, LockClosedSolidIcon),
  revealPassword: cuts(EyeIcon, EyeSolidIcon),
  hidePassword: cuts(EyeSlashIcon, EyeSlashSolidIcon),
  code: cuts(ShieldCheckIcon, ShieldCheckSolidIcon),
  complete: cuts(CheckCircleIcon, CheckCircleSolidIcon),
  pending: cuts(CircleIcon, CircleIcon),
  signIn: cuts(ArrowRightStartOnRectangleIcon, ArrowRightEndOnRectangleSolidIcon),
  signUp: cuts(UserPlusIcon, UserPlusSolidIcon),
  close: cuts(XMarkIcon, XMarkSolidIcon),
  next: cuts(ArrowRightIcon, ArrowRightSolidIcon),
  disclosure: cuts(ChevronRightIcon, ChevronRightSolidIcon),
  retry: cuts(ArrowPathIcon, ArrowPathSolidIcon),
  send: cuts(PaperAirplaneIcon, PaperAirplaneSolidIcon),
  home: cuts(HomeIcon, HomeSolidIcon),
  explore: cuts(GlobeAltIcon, GlobeAltSolidIcon),
  community: cuts(UserGroupIcon, UserGroupSolidIcon),
  league: cuts(TrophyIcon, TrophySolidIcon),
  review: cuts(ClipboardDocumentCheckIcon, ClipboardDocumentCheckSolidIcon),
  light: cuts(SunIcon, SunSolidIcon),
  dark: cuts(MoonIcon, MoonSolidIcon),
  locale: cuts(LanguageIcon, LanguageSolidIcon),
  search: cuts(MagnifyingGlassIcon, MagnifyingGlassSolidIcon),
  cart: cuts(ShoppingCartIcon, ShoppingCartSolidIcon),
  notification: cuts(BellIcon, BellSolidIcon),
  account: cuts(UserCircleIcon, UserCircleSolidIcon),
  saved: cuts(BookmarkIcon, BookmarkSolidIcon),
  blog: cuts(NewspaperIcon, NewspaperSolidIcon),
  talents: cuts(SparklesIcon, SparklesSolidIcon),
  jobs: cuts(BriefcaseIcon, BriefcaseSolidIcon),
  practice: cuts(CodeBracketIcon, CodeBracketSolidIcon),
  overview: cuts(Squares2X2Icon, Squares2X2SolidIcon),
  apps: cuts(WindowIcon, WindowSolidIcon),
  agentos: cuts(CpuChipIcon, CpuChipSolidIcon),
  servers: cuts(ServerStackIcon, ServerStackSolidIcon),
  domains: cuts(GlobeAmericasIcon, GlobeAmericasSolidIcon),
  wallet: cuts(WalletIcon, WalletSolidIcon),
  support: cuts(LifebuoyIcon, LifebuoySolidIcon),
  sidebar: cuts(SidebarSimpleIcon, SidebarSimpleIcon),
  google: cuts(GoogleMark, GoogleMark),
  github: cuts(GithubMark, GithubMark)
};

/** Resolve an app-owned semantic name to the glyph cut required by Grammar's public role. */
export const IconSource = (name: IconName, usage: IconUsage = "chip") => ICON_SOURCES[name][usage];

/**
 * The leaf's earlier name for {@link IconSource}, kept exported because the app call sites that
 * import it from `@nivo/ui` live outside this package. `IconSource` is the family name the folder
 * and its entry point share; the alias retires when those call sites move.
 */
export { IconSource as nivoIconSource };

