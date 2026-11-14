// The decisions of the project checks `record-names` and `record-ddl` (ext/checks/record-names.mjs, ext/checks/record-ddl.mjs), pure: no
// file, no build, no package loaded. The programs read the built packages and the committed files and hand them here. This file is no check:
// it lives in ext/support/ because the harness's R103 refuses a file of ext/checks/ that ext/manifest.json `checks` does not declare.
// Concept: .starciwork/concepts/records.md (record types `<package>.<agent>.<domain>`, record reads `<package>.<agent>.api.<domain>.<query>`).

/** The npm name of a package without its scope: `@nivo-lite/blocks-core` -> `blocks-core`. */
export const unscopedOf = (name) => (typeof name === "string" && name.startsWith("@") ? name.slice(name.indexOf("/") + 1) : name)

/**
 * The plugins whose declared `packageName` is not the npm name (without scope) of the package that exports them. `loaded` is one
 * `{ packageJsonName, plugin }` per installed package (the core package and each plugin the root package.json lists).
 */
export const packageNameFindings = (loaded) =>
    loaded.flatMap(({ packageJsonName, plugin }) => {
        const expected = unscopedOf(packageJsonName)
        const declared = plugin?.packageName
        if (declared === expected) return []
        return [
            {
                code: declared === undefined ? "PLUGIN_PACKAGE_NAME_MISSING" : "PLUGIN_PACKAGE_NAME_MISMATCH",
                plugin: plugin?.key ?? packageJsonName,
                at: packageJsonName,
                detail: declared === undefined ? `expected "${expected}"` : `declares "${declared}", package.json says "${expected}"`,
            },
        ]
    })

/** One line per finding, grouped by plugin, in a fixed order: what the check prints. */
export const findingLines = (findings) =>
    [...findings]
        .sort((left, right) =>
            left.plugin === right.plugin
                ? left.code === right.code
                    ? left.at.localeCompare(right.at)
                    : left.code.localeCompare(right.code)
                : left.plugin.localeCompare(right.plugin),
        )
        .map((finding) => `  ${finding.plugin}  ${finding.code}  ${finding.at}${finding.detail === undefined ? "" : `  (${finding.detail})`}`)

/** Whether two JSON texts say the same thing (the commit hook may fold the manifest's short arrays, so the bytes may differ). */
export const sameJson = (left, right) => {
    try {
        return JSON.stringify(JSON.parse(left)) === JSON.stringify(JSON.parse(right))
    } catch {
        return false
    }
}

/** The files of `record-ddl` that differ from what the declarations render: the manifest compared as JSON, the DDL byte for byte (CRLF read as LF). */
export const ddlDrift = ({ manifestText, ddlText }, { manifest, ddl }) => [
    ...(manifestText !== null && sameJson(manifestText, manifest) ? [] : ["db/entities.manifest.json"]),
    ...(ddlText !== null && ddlText.replaceAll("\r\n", "\n") === ddl ? [] : ["db/entities.ddl.sql"]),
]

/** The entity names one manifest lists and the other does not: what the drift message names. */
export const manifestDelta = (committedText, manifest) => {
    const namesOf = (text) => {
        try {
            return new Set((JSON.parse(text).entities ?? []).map((entity) => entity.entity))
        } catch {
            return new Set()
        }
    }
    const committed = namesOf(committedText ?? "{}")
    const rendered = namesOf(manifest)
    return {
        added: [...rendered].filter((name) => !committed.has(name)).sort(),
        dropped: [...committed].filter((name) => !rendered.has(name)).sort(),
    }
}
