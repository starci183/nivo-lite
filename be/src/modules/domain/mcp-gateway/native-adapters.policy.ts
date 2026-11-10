import { McpGatewayError, McpGatewayErrorCode } from "./errors/mcp-gateway.error"
import type { NativeAdapter } from "./mcp-gateway.contracts"

/**
 * The adapters by connector key, in the order the keys first appear. An adapter an app adds under a key a default already holds
 * (SePay with its status tool) takes the default's place, so no connector is listed twice and the one that runs is the last given.
 */
export const withoutShadowed = (adapters: ReadonlyArray<NativeAdapter>): ReadonlyArray<NativeAdapter> => [
    ...new Map(adapters.map((adapter) => [adapter.manifest.key, adapter])).values(),
]

/**
 * One connector holding the tools of both adapters of a key, each tool run by the adapter that declares it. The connector keeps the
 * base's name and version; its per-call limit is the longer of the two declared, so a tool never runs under a limit shorter than its own.
 * Two adapters declaring the same tool is a wiring bug, refused when the app starts.
 */
const mergedOf = (base: NativeAdapter, extra: NativeAdapter): NativeAdapter => {
    const extraTools = new Set(extra.manifest.tools.map((spec) => spec.name))
    const clash = base.manifest.tools.find((spec) => extraTools.has(spec.name))
    if (clash !== undefined) {
        throw new McpGatewayError({
            code: McpGatewayErrorCode.Invalid,
            params: { connector: base.manifest.key, tool: clash.name },
        })
    }
    const limits = [base.manifest.timeoutMs, extra.manifest.timeoutMs].filter((limit) => limit !== undefined)
    return {
        manifest: {
            ...base.manifest,
            tools: [...base.manifest.tools, ...extra.manifest.tools],
            ...(limits.length === 0 ? {} : { timeoutMs: Math.max(...limits) }),
        },
        invoke: (workspaceId, tool, args, caller) =>
            extraTools.has(tool)
                ? extra.invoke(workspaceId, tool, args, caller)
                : base.invoke(workspaceId, tool, args, caller),
    }
}

/**
 * The native adapters with NIVO's effect tools added: an effect domain whose key a native connector already holds (`payment`, `agent`)
 * joins that connector, any other is a connector of its own, after the natives.
 */
export const withEffectTools = (
    natives: ReadonlyArray<NativeAdapter>,
    effects: ReadonlyArray<NativeAdapter>,
): ReadonlyArray<NativeAdapter> => {
    const byKey = new Map(effects.map((adapter) => [adapter.manifest.key, adapter]))
    const joined = natives.map((native) => {
        const extra = byKey.get(native.manifest.key)
        return extra === undefined ? native : mergedOf(native, extra)
    })
    const keys = new Set(natives.map((native) => native.manifest.key))
    return [...joined, ...effects.filter((adapter) => !keys.has(adapter.manifest.key))]
}
