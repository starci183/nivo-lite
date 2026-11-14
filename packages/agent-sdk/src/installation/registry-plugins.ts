/** What the generator reads of a package's manifest (`package.json`). */
export interface PluginManifest {
    /** The installed version. */
    readonly version?: string | undefined
    /** The marker of a plugin package: `"nivo": { "plugin": true }`. */
    readonly nivo?: { readonly plugin?: boolean | undefined } | undefined
}

/** What the plugins of an app are resolved from: the app's own manifest and the manifests of what is installed. */
export interface PluginResolution {
    /** The plugin list of the app, `nivo.plugins` of the root `package.json`: the ONE place a plugin is added; undefined when absent. */
    readonly declared: ReadonlyArray<string> | undefined
    /** The dependencies of the root `package.json`, name to version range. */
    readonly dependencies: Readonly<Record<string, string>>
    /** The manifest of an installed package by name (wherever it resolves: `node_modules`, a workspace link), or null when not installed. */
    readonly manifestOf: (name: string) => PluginManifest | null
    /** Whether a version satisfies a range (`semver.satisfies`, prereleases included). */
    readonly satisfies: (version: string, range: string) => boolean
}

/** The plugins to install, by package name in name order, or why the registry cannot be built. */
export type ResolvedPlugins =
    | { readonly ok: true; readonly names: ReadonlyArray<string> }
    | { readonly ok: false; readonly problems: ReadonlyArray<string> }

/** Orders strings by code unit, so the same list gives the same registry on every machine. */
const byCodeUnit = (left: string, right: string): number => {
    if (left === right) return 0
    return left < right ? -1 : 1
}

/** What is wrong with one declared plugin, or null when it can be installed. */
const problemOf = (name: string, resolution: PluginResolution): string | null => {
    const range = resolution.dependencies[name]
    if (range === undefined) {
        return `${name} is listed in nivo.plugins but is not a dependency of the root package.json: add it to dependencies`
    }
    const manifest = resolution.manifestOf(name)
    if (manifest === null) return `${name} is listed in nivo.plugins but is not installed: run npm install`
    if (manifest.nivo?.plugin !== true) {
        return `${name} is listed in nivo.plugins but its package.json does not say "nivo": { "plugin": true }`
    }
    const version = manifest.version ?? ""
    if (!resolution.satisfies(version, range)) {
        return `${name} is installed at ${version === "" ? "an unknown version" : version}, which does not satisfy ${range} of the root package.json: install the declared version`
    }
    return null
}

/**
 * The plugin packages an app installs, resolved by PACKAGE NAME: a plugin may be a workspace folder of the repository or a package
 * installed from a registry under `node_modules`, the generator does not tell them apart. With a plugin list (`nivo.plugins` of the
 * root `package.json`) the list is the one place a plugin is added, and every entry must be a root dependency, be installed, be marked
 * a plugin and be installed at a version its declared range admits; a root dependency marked a plugin that the list leaves out is a
 * problem too, so nothing is installed by accident. Without a list (an app that declares none yet) the plugins are the root
 * dependencies whose installed manifest marks them a plugin. Every problem is named; none is skipped silently.
 */
export const resolvePlugins = (resolution: PluginResolution): ResolvedPlugins => {
    const marked = Object.keys(resolution.dependencies).filter(
        (name) => resolution.manifestOf(name)?.nivo?.plugin === true,
    )
    if (resolution.declared === undefined) return { ok: true, names: [...marked].sort(byCodeUnit) }
    const declared = [...new Set(resolution.declared)].sort(byCodeUnit)
    const problems = [
        ...declared.flatMap((name) => {
            const problem = problemOf(name, resolution)
            return problem === null ? [] : [problem]
        }),
        ...marked
            .filter((name) => !declared.includes(name))
            .sort(byCodeUnit)
            .map((name) => `${name} is an installed plugin package but nivo.plugins does not list it: add it to the list or remove the dependency`),
    ]
    return problems.length === 0 ? { ok: true, names: declared } : { ok: false, problems }
}
