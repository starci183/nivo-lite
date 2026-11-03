"use client"

import * as Outline from "@heroicons/react/24/outline"
import { Icon as GrammarIcon, IconTile } from "@starci/grammar/common"
import type { IconUsage } from "@starci/grammar/common"

import type { ForwardRefExoticComponent, ReactElement, RefAttributes, SVGProps } from "react"

type GlyphsShape = {
    readonly account: ForwardRefExoticComponent<
        Omit<SVGProps<SVGSVGElement>, "ref"> & {
            title?: string
            titleId?: string
        } & RefAttributes<SVGSVGElement>
    >
    readonly agentos: ForwardRefExoticComponent<
        Omit<SVGProps<SVGSVGElement>, "ref"> & {
            title?: string
            titleId?: string
        } & RefAttributes<SVGSVGElement>
    >
    readonly complete: ForwardRefExoticComponent<
        Omit<SVGProps<SVGSVGElement>, "ref"> & {
            title?: string
            titleId?: string
        } & RefAttributes<SVGSVGElement>
    >
    readonly next: ForwardRefExoticComponent<
        Omit<SVGProps<SVGSVGElement>, "ref"> & {
            title?: string
            titleId?: string
        } & RefAttributes<SVGSVGElement>
    >
    readonly notification: ForwardRefExoticComponent<
        Omit<SVGProps<SVGSVGElement>, "ref"> & {
            title?: string
            titleId?: string
        } & RefAttributes<SVGSVGElement>
    >
    readonly pending: ForwardRefExoticComponent<
        Omit<SVGProps<SVGSVGElement>, "ref"> & {
            title?: string
            titleId?: string
        } & RefAttributes<SVGSVGElement>
    >
    readonly review: ForwardRefExoticComponent<
        Omit<SVGProps<SVGSVGElement>, "ref"> & {
            title?: string
            titleId?: string
        } & RefAttributes<SVGSVGElement>
    >
    readonly search: ForwardRefExoticComponent<
        Omit<SVGProps<SVGSVGElement>, "ref"> & {
            title?: string
            titleId?: string
        } & RefAttributes<SVGSVGElement>
    >
    readonly send: ForwardRefExoticComponent<
        Omit<SVGProps<SVGSVGElement>, "ref"> & {
            title?: string
            titleId?: string
        } & RefAttributes<SVGSVGElement>
    >
    readonly support: ForwardRefExoticComponent<
        Omit<SVGProps<SVGSVGElement>, "ref"> & {
            title?: string
            titleId?: string
        } & RefAttributes<SVGSVGElement>
    >
    readonly wallet: ForwardRefExoticComponent<
        Omit<SVGProps<SVGSVGElement>, "ref"> & {
            title?: string
            titleId?: string
        } & RefAttributes<SVGSVGElement>
    >
}

/** The glyphs the landing draws: one outline drawing per meaning. */
const GLYPHS: GlyphsShape = {
    account: Outline.UserCircleIcon,
    agentos: Outline.CpuChipIcon,
    complete: Outline.CheckCircleIcon,
    next: Outline.ArrowRightIcon,
    notification: Outline.BellIcon,
    pending: Outline.EllipsisHorizontalCircleIcon,
    review: Outline.ClipboardDocumentCheckIcon,
    search: Outline.MagnifyingGlassIcon,
    send: Outline.PaperAirplaneIcon,
    support: Outline.LifebuoyIcon,
    wallet: Outline.WalletIcon,
} as const

/** What an icon MEANS on the landing; the glyph that draws it is this file's business. */
export type IconGlyphName = keyof typeof GLYPHS

/** The glyph source of a meaning, for the grammar parts that take a source (the icon tile). */
const iconGlyphOf = (name: IconGlyphName) => GLYPHS[name]

/** What the glyph draws: a meaning, never a component, so a Server Component caller crosses the boundary with a plain name. */
type IconGlyphProps = {
    readonly name: IconGlyphName
    readonly usage?: IconUsage
    readonly ariaLabel?: string
    /** Draw the glyph on a neutral identity tile instead of bare. */
    readonly isTile?: boolean
}

/** The landing glyph, bare or on a neutral tile; the client boundary lets a server component hand over a NAME, never a glyph function. */
export const IconGlyph = (props: IconGlyphProps): ReactElement =>
    props.isTile ? (
        <IconTile source={iconGlyphOf(props.name)} tone="neutral" size="sm" />
    ) : (
        <GrammarIcon
            source={iconGlyphOf(props.name)}
            {...(props.usage !== undefined && { usage: props.usage })}
            {...(props.ariaLabel !== undefined && { ariaLabel: props.ariaLabel })}
        />
    )
