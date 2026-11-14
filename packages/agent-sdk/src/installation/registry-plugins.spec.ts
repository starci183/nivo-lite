import { resolvePlugins } from "./registry-plugins"
import type { PluginManifest, PluginResolution } from "./registry-plugins"

/** What is installed, by package name: a workspace package and a package that exists only under node_modules, alike. */
const INSTALLED: Readonly<Record<string, PluginManifest>> = {
    "@app/local-plugin": { version: "0.1.0", nivo: { plugin: true } },
    "@vendor/registry-plugin": { version: "1.4.2", nivo: { plugin: true } },
    "left-pad": { version: "1.3.0" },
}

/** A range check good enough for the cases here: `*` admits all, `^1.x` the major 1, anything else an exact version. */
const satisfies = (version: string, range: string): boolean => {
    if (range === "*") return true
    if (range.startsWith("^")) return version.split(".")[0] === range.slice(1).split(".")[0]
    return version === range
}

const resolutionOf = (patch: Partial<PluginResolution>): PluginResolution => ({
    declared: ["@vendor/registry-plugin", "@app/local-plugin"],
    dependencies: { "@app/local-plugin": "*", "@vendor/registry-plugin": "^1.0.0", "left-pad": "1.3.0" },
    manifestOf: (name) => INSTALLED[name] ?? null,
    satisfies,
    ...patch,
})

describe("resolvePlugins", () => {
    it("installs every listed plugin by package name, in name order, wherever the package resolves from", () => {
        expect(resolvePlugins(resolutionOf({}))).toEqual({
            ok: true,
            names: ["@app/local-plugin", "@vendor/registry-plugin"],
        })
    })

    it("without a list, installs the root dependencies whose installed manifest marks them a plugin", () => {
        expect(resolvePlugins(resolutionOf({ declared: undefined }))).toEqual({
            ok: true,
            names: ["@app/local-plugin", "@vendor/registry-plugin"],
        })
    })

    it("fails on a listed plugin that is not installed, saying so", () => {
        const result = resolvePlugins(
            resolutionOf({ manifestOf: (name) => (name === "@vendor/registry-plugin" ? null : (INSTALLED[name] ?? null)) }),
        )
        expect(result).toEqual({
            ok: false,
            problems: ["@vendor/registry-plugin is listed in nivo.plugins but is not installed: run npm install"],
        })
    })

    it("fails on a plugin installed at a version its declared range does not admit, naming both", () => {
        const result = resolvePlugins(
            resolutionOf({ dependencies: { "@app/local-plugin": "*", "@vendor/registry-plugin": "^2.0.0" } }),
        )
        expect(result).toEqual({
            ok: false,
            problems: [
                "@vendor/registry-plugin is installed at 1.4.2, which does not satisfy ^2.0.0 of the root package.json: install the declared version",
            ],
        })
    })

    it("fails on a listed name that is no root dependency, or whose package is not marked a plugin", () => {
        const result = resolvePlugins(
            resolutionOf({ declared: ["@vendor/absent", "left-pad", "@app/local-plugin", "@vendor/registry-plugin"] }),
        )
        expect(result).toEqual({
            ok: false,
            problems: [
                "@vendor/absent is listed in nivo.plugins but is not a dependency of the root package.json: add it to dependencies",
                'left-pad is listed in nivo.plugins but its package.json does not say "nivo": { "plugin": true }',
            ],
        })
    })

    it("fails on an installed plugin dependency the list leaves out, so nothing is installed by accident", () => {
        expect(resolvePlugins(resolutionOf({ declared: ["@app/local-plugin"] }))).toEqual({
            ok: false,
            problems: [
                "@vendor/registry-plugin is an installed plugin package but nivo.plugins does not list it: add it to the list or remove the dependency",
            ],
        })
    })

    it("reports an installed plugin whose manifest names no version as an unknown version", () => {
        const result = resolvePlugins(
            resolutionOf({
                declared: ["@app/local-plugin"],
                dependencies: { "@app/local-plugin": "0.1.0" },
                manifestOf: () => ({ nivo: { plugin: true } }),
            }),
        )
        expect(result).toEqual({
            ok: false,
            problems: [
                "@app/local-plugin is installed at an unknown version, which does not satisfy 0.1.0 of the root package.json: install the declared version",
            ],
        })
    })
})
