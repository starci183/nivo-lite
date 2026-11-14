import { z } from "zod"
import { definePort } from "@nivo-lite/agent-sdk/port"
import type { BlockDefinition, ReadDefinition } from "@nivo-lite/agent-sdk/block"
import { isApiVerb, type DataShape, type Namespaced } from "@nivo-lite/agent-sdk/schema"
import type { SpecNode, SpecReadBinding, StoredSpec } from "@nivo-lite/agent-sdk/spec"

/** What tells the old spelling of a provider read (`<provider>:<read>`, stored bindings keep it) from a module read (`<module>.<name>`) in a binding. */
const PROVIDER_READ_MARK = ":"

/**
 * Whether a name a spec binds is a provider's interface read: an API verb (`nivo.api.<provider>.<op>`, what interfaces write now, tools.md)
 * or the old `<provider>:<read>` a stored binding may hold (`openapi:nivo.api.crm.get.customers` carries the mark too). The one generic
 * door serves both by their name; no provider is named here.
 */
export const isProviderRead = (name: string): name is Namespaced => isApiVerb(name) || name.includes(PROVIDER_READ_MARK)

/** The permission of a provider read in the browser: none beyond the viewer's session. The door proves the member and asks the provider's seam; the node's own `when.permission` decides whether the block is drawn. */
const NO_BROWSER_PERMISSION = ""

/** The provider answers its own pages and the host pages them through the cursor; this marker only says "paged". Nothing reads the size. */
const PROVIDER_PAGED = definePort<never>("provider.paged")

/** One provider-read binding found in a spec, with the shape and data kind of the slot it fills. */
interface FoundBinding {
    readonly binding: SpecReadBinding
    readonly shape: DataShape
    readonly dataKind: string | undefined
    /** The variables bound to the search or the filter of the node: the list stays whole while they hold nothing. */
    readonly optional: ReadonlySet<string>
}

/** The props of a block that name the param its search box or its filter writes, by the convention every core block follows. */
const LIST_PARAM_PROPS: ReadonlyArray<string> = ["searchParam", "filterParam"]

/** What a binding variable starts with when it reads a param of the node. */
const PARAM_REFERENCE_MARK = "$"

/** The variables of a binding that read the search or the filter param of the node. */
const listVariablesOf = (node: SpecNode, binding: SpecReadBinding): ReadonlySet<string> => {
    const params = LIST_PARAM_PROPS.map((prop) => node.props?.[prop]).filter((value) => typeof value === "string")
    return new Set(
        Object.entries(binding.variables ?? {})
            .filter(([, value]) => params.some((param) => value === `${PARAM_REFERENCE_MARK}${param}`))
            .map(([name]) => name),
    )
}

/** The nodes of a spec in drawing order: head, foot, aside and every view's tree. */
const nodesOf = (spec: StoredSpec): ReadonlyArray<SpecNode> => {
    const roots: Array<SpecNode> = [...(spec.head ?? []), ...(spec.foot ?? [])]
    if (spec.aside !== undefined) roots.push(spec.aside)
    for (const view of spec.views) roots.push(view.root)
    const all: Array<SpecNode> = []
    const visit = (node: SpecNode): void => {
        all.push(node)
        node.children?.forEach((child) => visit(child))
    }
    roots.forEach((root) => visit(root))
    return all
}

/** Every provider-read binding of the spec, against the read slot of the block it binds. A count of a view or the summary of the aside is one record. */
const bindingsOf = (spec: StoredSpec, blocks: ReadonlyArray<BlockDefinition>): ReadonlyArray<FoundBinding> => {
    const found: Array<FoundBinding> = []
    for (const node of nodesOf(spec)) {
        const block = blocks.find((candidate) => candidate.id === node.block)
        for (const [slotName, binding] of Object.entries(node.bind ?? {})) {
            const slot = block?.slots[slotName]
            if ("read" in binding && isProviderRead(binding.read) && slot?.kind === "read")
                found.push({
                    binding,
                    shape: slot.shape,
                    dataKind: slot.dataKind,
                    optional: listVariablesOf(node, binding),
                })
        }
    }
    for (const view of spec.views)
        if (view.count !== undefined && isProviderRead(view.count.read))
            found.push({ binding: view.count, shape: "record", dataKind: undefined, optional: new Set() })
    if (spec.asideSummary !== undefined && isProviderRead(spec.asideSummary.read))
        found.push({ binding: spec.asideSummary, shape: "record", dataKind: undefined, optional: new Set() })
    return found
}

/** The value a variable takes. */
const variableValue = z.union([z.string(), z.number(), z.boolean(), z.null()])

/**
 * The variables of a provider read: every one the binding sets, any value. A variable bound to the search or the filter param of its
 * node is optional (the list reads whole until something is typed); another one waits for its param (the detail of a row reads once a
 * row is chosen). The provider's own input schema judges what it finally gets.
 */
const variablesOf = (
    names: ReadonlyArray<string>,
    optional: ReadonlySet<string>,
): z.ZodObject<Record<string, z.ZodType>> =>
    z.object(
        Object.fromEntries(names.map((name) => [name, optional.has(name) ? variableValue.optional() : variableValue])),
    )

/** The definition of one provider read, drawn from what the spec binds and the slot that takes it. */
const definitionOf = (id: Namespaced, found: ReadonlyArray<FoundBinding>): ReadDefinition => {
    const first = found[0]
    const shape = first?.shape ?? "record"
    const names = [...new Set(found.flatMap((entry) => Object.keys(entry.binding.variables ?? {})))]
    const optional = new Set(
        names.filter((name) =>
            found.every((entry) => entry.optional.has(name) || entry.binding.variables?.[name] === undefined),
        ),
    )
    const paths: Record<string, DataShape> = {}
    for (const entry of found) if (entry.binding.path !== undefined) paths[entry.binding.path] = entry.shape
    if (shape === "list") paths.rows = "list"
    return {
        entry: "read",
        id,
        dataKind: first?.dataKind ?? "provider",
        shape,
        fields: [],
        paths,
        variables: variablesOf(names, optional),
        operation: id,
        permission: NO_BROWSER_PERMISSION,
        listing:
            shape === "list"
                ? {
                      kind: "list",
                      shape: { sort: {}, page: { size: 0 }, row: { id: "id", title: "id" } },
                      defaultSort: "",
                      source: PROVIDER_PAGED,
                  }
                : undefined,
    }
}

/**
 * The reads of the provider reads a spec binds, so the spec host can run a binding `{ read: "<provider>:<read>", variables }` like a
 * module read: the operation IS the read name (the generic person-read door dispatches by it, proves the member and answers
 * `page` / `record` with `source` and `asOf`), the shape and data kind come from the slot of the block it fills, and every variable
 * the binding sets is accepted. Nothing here names a provider or a read.
 */
export const providerReadsOf = (
    spec: StoredSpec,
    blocks: ReadonlyArray<BlockDefinition>,
): ReadonlyArray<ReadDefinition> => {
    const byName = new Map<Namespaced, Array<FoundBinding>>()
    for (const entry of bindingsOf(spec, blocks)) {
        const id = entry.binding.read
        if (!isProviderRead(id)) continue
        byName.set(id, [...(byName.get(id) ?? []), entry])
    }
    return [...byName.entries()].map(([id, found]) => definitionOf(id, found))
}
