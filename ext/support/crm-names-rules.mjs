// The decisions of the project check `crm-names` (ext/checks/crm-names.mjs), pure so ext/tests/crm-names.spec.mjs judges them on fixtures.
// A CRM is a provider connected through its OpenAPI document (owner chốt 2026-11-13); a package declares the CRMs it supports with
// `defineProviderTemplate({ kind: "crm", id, openapi, ... })` in its plugin's `providers` (owner chốt 2026-11-14), and the id lives only there.

/** Structural equality of two JSON values (key order ignored). */
export const sameJson = (a, b) => {
    if (a === b) return true
    if (typeof a !== "object" || typeof b !== "object" || a === null || b === null) return false
    if (Array.isArray(a) !== Array.isArray(b)) return false
    if (Array.isArray(a)) return a.length === b.length && a.every((item, index) => sameJson(item, b[index]))
    const keys = Object.keys(a)
    return keys.length === Object.keys(b).length && keys.every((key) => Object.hasOwn(b, key) && sameJson(a[key], b[key]))
}

/**
 * The findings on the declared templates of every package: `packages` = [{ name, templates: [{ kind, id, openapi }], pinned: Map<id, document> }]
 * (`pinned` = the `src/crm/<id>/openapi.json` files the package holds). A finding: a template id declared by two packages (or twice by one),
 * a template whose `src/<kind>/<id>/openapi.json` is missing, a template whose `openapi` is not that pinned file, and a pinned folder no
 * template of the package declares. Each finding is `{ pkg, text }`, in package then declaration order.
 */
export const templateFindings = (packages) => {
    const findings = []
    const owners = new Map()
    for (const pkg of packages) {
        for (const template of pkg.templates) owners.set(template.id, [...(owners.get(template.id) ?? []), pkg.name])
    }
    for (const [id, names] of owners) {
        if (names.length > 1) {
            findings.push({ pkg: names[0], text: `template id \`${id}\` is declared ${names.length} times (${names.join(", ")}); a provider template id is globally unique` })
        }
    }
    for (const pkg of packages) {
        const declared = new Set(pkg.templates.map((template) => template.id))
        for (const template of pkg.templates) {
            const document = pkg.pinned.get(template.id)
            if (document === undefined) {
                findings.push({ pkg: pkg.name, text: `template \`${template.kind}.${template.id}\` has no pinned src/${template.kind}/${template.id}/openapi.json` })
            } else if (!sameJson(template.openapi, document)) {
                findings.push({ pkg: pkg.name, text: `template \`${template.kind}.${template.id}\`: its \`openapi\` is not the pinned src/${template.kind}/${template.id}/openapi.json` })
            }
        }
        for (const id of pkg.pinned.keys()) {
            if (!declared.has(id)) findings.push({ pkg: pkg.name, text: `src/crm/${id}/openapi.json is pinned but no \`defineProviderTemplate\` of the plugin declares \`${id}\`` })
        }
    }
    return findings
}

/**
 * The findings on the CRM operation names one package's sources use: `uses` = [{ file, line, text, id, rest }] (every
 * `nivo.api.crm.<id><rest>` text), `ops` = Map<id, Set<op name>> of the templates THIS package declares. A use of an id the package declares
 * no template for, or of an operation its template's document lacks, is a finding; a bare prefix (`rest` empty) only checks the id.
 */
export const usedOpFindings = (uses, ops) =>
    uses.flatMap((use) => {
        const known = ops.get(use.id)
        if (known === undefined) {
            return [{ ...use, problem: `\`${use.text}\`: the package declares no CRM template \`${use.id}\`; a CRM belongs to the package that declares its template` }]
        }
        return use.rest !== "" && !known.has(use.text) ? [{ ...use, problem: `\`${use.text}\` is no operation of the document the package pins for CRM \`${use.id}\`` }] : []
    })
