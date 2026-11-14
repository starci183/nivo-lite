import { sourceOfTool } from "@modules/domain/openapi-tools"

/** One installed module as the offer reads it: whether its plugin is open to the workspace, and the tools its agent holds. */
export interface OfferModule {
    /** True when the module's plugin is open to the workspace (a public plugin, or a private one that names its enterprise). */
    readonly open: boolean
    /** The tools the module's agent holds, by full id. */
    readonly tools: ReadonlyArray<string>
}

/** The sources the agents of the modules that are open (or closed) to the workspace use: a tool `nivo.tool.<key>.…` uses `<key>`. */
const usedSourcesOf = (modules: ReadonlyArray<OfferModule>, open: boolean, sources: ReadonlyArray<string>): ReadonlySet<string> =>
    new Set(
        modules
            .filter((module) => module.open === open)
            .flatMap((module) => module.tools.flatMap((tool) => sourceOfTool(tool, sources) ?? [])),
    )

/**
 * The sources whose API reads (`nivo.api.<key>.…`) a person of a workspace may be offered: every source a module open to the
 * workspace uses, and no source a module closed to it uses. A source is known to belong to a plugin by its agents using it (a tool
 * whose id starts with `nivo.tool.<key>.`, the static rule), so a private plugin's source stays closed to a workspace the plugin does
 * not name. Which reads of an open source exist is the pinned document's (its GET operations); a write is never a read.
 */
export const openSourcesOf = (modules: ReadonlyArray<OfferModule>, sources: ReadonlyArray<string>): ReadonlySet<string> => {
    const open = usedSourcesOf(modules, true, sources)
    const closed = usedSourcesOf(modules, false, sources)
    return new Set([...open].filter((source) => !closed.has(source)))
}
