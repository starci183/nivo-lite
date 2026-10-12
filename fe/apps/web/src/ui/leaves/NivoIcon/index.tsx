"use client"

import { Icon } from "@starci/grammar/common"
import type { IconUsage } from "@starci/grammar/common"
import { nivoIconSource, type IconName } from "../Icon"

/** What the client-resolved glyph draws. */
export type NivoIconData = {
    readonly name: IconName
    readonly usage?: IconUsage
    readonly ariaLabel?: string
}

/** Props for {@link NivoIcon}. */
export type NivoIconProps = { readonly props: NivoIconData }

/**
 * LEAF - `NivoIcon`: the client boundary an app-owned glyph needs to reach a Server Component caller.
 *
 * WHY THIS EXISTS. `@starci/grammar/common` is a `"use client"` barrel, so Grammar's `Icon` is a Client
 * Component from Next's point of view even though its own file carries no directive. A Server
 * Component that resolves `nivoIconSource(name, usage)` to a glyph function and hands that function
 * to `Icon` as `source` is passing a function across the server -> client boundary, which React
 * refuses to serialise - that is the exact shape of "Functions cannot be passed directly to Client
 * Components" that took `GET /` down.
 *
 * THE FIX IS A NAME CROSSING, NOT A FUNCTION CROSSING. A Server Component caller passes the
 * serialisable `IconName` key across this leaf's props; this file is itself `"use client"`, so the
 * resolution to a glyph component and the call into Grammar's `Icon` both happen already on the
 * client side of the boundary, where a function reference never needs to serialise.
 */
export const NivoIcon = (props: NivoIconProps) => {
    const { name, usage, ariaLabel } = props.props
    return <Icon source={nivoIconSource(name, usage)} usage={usage} ariaLabel={ariaLabel} />
}
