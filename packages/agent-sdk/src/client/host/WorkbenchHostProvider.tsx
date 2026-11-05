"use client"

import { createContext, useContext, useMemo } from "react"
import type { ReactNode } from "react"
import type { BlockHost } from "../../block/block.types"
import type { WorkbenchHost } from "../../host/host.types"
import type { BlockRenderer } from "../renderer/define-renderer"

/**
 * What the live host compares: the registry hash this bundle was built with and the one the back end serves, with the words of
 * the notice shown on a mismatch (the app's own catalogue, so the notice reads in the viewer's language).
 */
export interface RegistryCheck {
    /** The hash of the installed registry this bundle was generated with. */
    readonly built: string
    /** The hash of the registry the back end runs. */
    readonly served: string
    /** What the notice says: a new version is out. */
    readonly message: string
    /** The label of the action that loads the newest bundle. */
    readonly reloadLabel: string
    /** Loads the newest bundle. */
    readonly reload: () => void
}

/** What the provider holds for the renderer and the blocks. */
interface HostContextValue {
    readonly host: WorkbenchHost
    readonly blocks: ReadonlyArray<BlockRenderer>
    readonly enabled: ReadonlyArray<string>
    readonly registry: RegistryCheck | null
}

const HostContext = createContext<HostContextValue | null>(null)

/** What the provider takes. */
export interface WorkbenchHostProviderProps {
    readonly host: WorkbenchHost
    /** The renderer of every installed block, each loaded when first drawn (`@nivo-lite/plugin-registry/client`). */
    readonly blocks: ReadonlyArray<BlockRenderer>
    /** The keys of the modules enabled for the workspace. */
    readonly enabled: ReadonlyArray<string>
    /** The live host's registry comparison; null where the app has no back-end registry to compare with (a prototype). */
    readonly registry: RegistryCheck | null
    readonly children: ReactNode
}

/** Mounts the host, the installed blocks and the enabled modules once; the renderer and every block reach them through it. */
export const WorkbenchHostProvider = (props: WorkbenchHostProviderProps): ReactNode => {
    const { host, blocks, enabled, registry } = props
    const value = useMemo<HostContextValue>(
        () => ({ host, blocks, enabled, registry }),
        [host, blocks, enabled, registry],
    )
    return <HostContext.Provider value={value}>{props.children}</HostContext.Provider>
}

/** The context of the nearest provider; throws when none is mounted, which is a wiring defect. */
const useHostContext = (): HostContextValue => {
    const value = useContext(HostContext)
    if (value === null) throw new RangeError("WorkbenchHostProvider is not mounted")
    return value
}

/** The host of the nearest provider; throws when none is mounted, which is a wiring defect. */
export const useWorkbenchHost = (): WorkbenchHost => useHostContext().host

/** The ports a block may use. */
export const useBlockHost = (): BlockHost => useWorkbenchHost().block

/** The renderer of every installed block. */
export const useInstalledBlocks = (): ReadonlyArray<BlockRenderer> => useHostContext().blocks

/** The keys of the modules enabled for the workspace. */
export const useEnabledModules = (): ReadonlyArray<string> => useHostContext().enabled

/** The registry comparison of the live host; null in a prototype. */
export const useRegistryCheck = (): RegistryCheck | null => useHostContext().registry
