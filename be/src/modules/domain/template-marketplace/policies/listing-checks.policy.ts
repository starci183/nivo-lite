import { agentTemplatePackageSchema } from "@modules/domain/agent-templates"
import { canonicalJson, previewPackage, type AgentTemplatePackage } from "@nivo-lite/agent-sdk/template"
import { createHash } from "node:crypto"
import type { ListingCheck } from "../template-marketplace.contracts"

/** What the automated checks need to know about the platform. */
export interface ListingChecksContext {
    /** The keys of the plug-ins registered in this app. */
    readonly pluginKeys: ReadonlySet<string>
    /** True when the gateway knows the tool. */
    readonly knownTool: (tool: string) => boolean
    /** True when the persona of a real person is covered by a valid consent. */
    readonly consented: boolean
}

const check = (id: string, ok: boolean, detail: string): ListingCheck => ({ id, ok, detail })

const hashOf = (pkg: AgentTemplatePackage): string => {
    const body = Object.fromEntries(Object.entries(pkg).filter(([name]) => name !== "hash"))
    return createHash("sha256").update(canonicalJson(body)).digest("hex")
}

/**
 * The automated checks a version passes before a person reviews its listing: the package parses and keeps its hash; nothing of the
 * creator or a customer is left in it; every plug-in it names exists; it proposes no right the kind of agent does not need; every tool
 * it uses is in the gateway; and a persona of a real person has its consent.
 */
export const runListingChecks = (
    pkg: AgentTemplatePackage,
    context: ListingChecksContext,
): ReadonlyArray<ListingCheck> => {
    const parsed = agentTemplatePackageSchema.safeParse(pkg)
    const leak = previewPackage(pkg.graph, {
        key: pkg.key,
        version: pkg.version,
        publisher: pkg.publisher,
        baseModule: pkg.baseModule,
        requiresPlugins: pkg.requiresPlugins,
        listing: pkg.listing,
        parameters: pkg.parameters,
        bindings: pkg.bindings,
        starterKnowledge: pkg.starterKnowledge,
        persona: pkg.persona,
        forbidden: [],
    })
    const missingPlugins = pkg.requiresPlugins
        .filter((plugin) => !context.pluginKeys.has(plugin.key))
        .map((plugin) => plugin.key)
    const unknownTools = pkg.graph.nodes.flatMap((node) =>
        node.uses.flatMap((use) => (use.tool === null || context.knownTool(use.tool) ? [] : [use.tool])),
    )
    return [
        check("schema", parsed.success && hashOf(pkg) === pkg.hash, parsed.success ? "hash" : "format"),
        check("no_creator_data", leak.problems.length === 0, leak.problems.slice(0, 5).join("; ")),
        check("plugins", missingPlugins.length === 0, missingPlugins.join(", ")),
        check("tools", unknownTools.length === 0, unknownTools.join(", ")),
        check("likeness_consent", context.consented, pkg.persona.likeness?.personName ?? ""),
    ]
}
