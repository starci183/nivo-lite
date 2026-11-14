import { Inject, Injectable, Optional } from "@nestjs/common"
import {
    PLUGIN_TOOLS,
    PLUGIN_TOOL_DECLARATIONS,
    declarationsOf,
    type PluginToolCall,
    type PluginToolDeclaration,
    type PluginTools,
} from "@nivo-lite/agent-sdk/plugin-tools"
import { isServiceOf, type AnyServiceDefinition } from "@nivo-lite/agent-sdk/service"
import { CONTEXT_NOTICE, type ContextAudience, type LockedSubject } from "@modules/domain/context-sources"
import { EntityEngineError, EntityEngineErrorCode } from "@modules/domain/entity-engine"
import { INSTALLED } from "@modules/domain/installed-plugins"
import { LeadMemoryService, leadMemorySubjectOf } from "@modules/domain/lead-memory"
import { InjectPluginServices, type PluginServicesApi } from "@modules/domain/plugin-services"
import { NIVO_TOOL_PREFIX, argumentsOf, unknownTool, type ManifestTool, type ToolJson } from "@modules/domain/tools"
import { nativeRefusal } from "./native-refusal.policy"

/** The installed services this family reads its tools from; absent: the app's installation (`INSTALLED`). A spec passes a fixture. */
export const PLUGIN_TOOL_SERVICES: unique symbol = Symbol("native-tools.plugin-tool-services")

/** The installed services as a list. */
export interface PluginToolServices {
    /** Every installed service, of any contract. */
    readonly services: () => ReadonlyArray<AnyServiceDefinition>
}

/** A tool a plugin declared, with the module that ships it. */
interface Shipped {
    /** The declaration. */
    readonly declaration: PluginToolDeclaration
    /** The module whose agent owns the service that runs it. */
    readonly moduleKey: string
    /** The manifest entry the connector lists. */
    readonly manifest: ManifestTool
}

/** The tool name inside the `nivo-context` connector: the public id without the `nivo.tool.` prefix. */
const nameOfId = (id: string): string => id.slice(NIVO_TOOL_PREFIX.length + 1)

/** Every tool the installed declarations services declare, with its module and its manifest entry (static: no workspace, no port). */
const shippedOf = (installed: PluginToolServices): ReadonlyArray<Shipped> =>
    installed.services().flatMap((service): ReadonlyArray<Shipped> => {
        if (!isServiceOf(service, PLUGIN_TOOL_DECLARATIONS)) return []
        return declarationsOf(service).tools.map((declaration) => ({
            declaration,
            moduleKey: service.moduleKey,
            manifest: {
                name: nameOfId(declaration.id),
                description: declaration.description,
                scope: declaration.scope,
                defaultMode: declaration.defaultMode,
                inputSchema: declaration.inputSchema,
                argumentSchema: declaration.argumentSchema,
                ...(declaration.secretFields === undefined ? {} : { secretFields: declaration.secretFields }),
            },
        }))
    })

/** The manifest entries of the tools an installation's plugins serve, in the order the connector lists them. */
export const pluginToolManifestsOf = (installed: PluginToolServices): ReadonlyArray<ManifestTool> =>
    shippedOf(installed).map((entry) => entry.manifest)

@Injectable()
/**
 * The tools the installed plugins serve through the `PLUGIN_TOOLS` contract, as a part of the `nivo-context` connector: the engine lists
 * the declarations of every installed declarations service (static, no workspace) and, on a call, resolves the tools service of the
 * module that ships the tool and delegates to it. It knows no tool id, record or status: the plugin's service holds all of them. The
 * facts of the run (conversation, person, customer, audience, lead memory) are the engine's, fixed by the connector before this part
 * runs; the arguments are validated with the tool's own validator first. A service reads the workspace's records as the module's agent
 * with `sees: "all"` (the reach the context reads always had: every record of the workspace, never confined to the calling agent).
 */
export class PluginToolsNativeService {
    private readonly shipped: ReadonlyArray<Shipped>

    constructor(
        @Optional() @InjectPluginServices() private readonly services?: PluginServicesApi,
        @Optional() private readonly memory?: LeadMemoryService,
        @Optional() @Inject(PLUGIN_TOOL_SERVICES) installed?: PluginToolServices,
    ) {
        this.shipped = shippedOf(installed ?? INSTALLED)
    }

    /** The tools of every installed plugin, as the connector lists them. */
    get tools(): ReadonlyArray<ManifestTool> {
        return this.shipped.map((entry) => entry.manifest)
    }

    /** True for a tool name (inside the connector) an installed plugin serves. */
    serves(tool: string): boolean {
        return this.shipped.some((entry) => entry.manifest.name === tool)
    }

    /** Runs one tool for the locked subject and the caller's audience: the plugin's answer, or the refusal it gave. */
    async read(
        workspaceId: string,
        tool: string,
        args: ToolJson,
        subject: LockedSubject,
        audience: ContextAudience,
        agentId: string | null = null,
    ): Promise<ToolJson> {
        const entry = this.shipped.find((candidate) => candidate.manifest.name === tool)
        if (entry === undefined) throw unknownTool(tool)
        const input = argumentsOf(tool, entry.declaration.argumentSchema, args)
        if (this.services === undefined) throw nativeRefusal("not_served")
        const service = await this.serviceOf(workspaceId, entry.moduleKey)
        const answer = await service.call(entry.declaration.id, input, this.callOf(workspaceId, subject, audience, agentId))
        if (!answer.ok) throw nativeRefusal(answer.reason)
        return answer.value
    }

    /**
     * The tools service of a module, built to read every record of the workspace (as the module's oldest installed agent); a workspace
     * that installed no agent of the module has none of its records: the refusal `not_found`.
     */
    private async serviceOf(workspaceId: string, moduleKey: string): Promise<PluginTools> {
        try {
            return await this.build(workspaceId, moduleKey)
        } catch (cause) {
            if (cause instanceof EntityEngineError && cause.code === EntityEngineErrorCode.AgentMissing) throw nativeRefusal("not_found", cause)
            throw cause
        }
    }

    private build(workspaceId: string, moduleKey: string): Promise<PluginTools> {
        if (this.services === undefined) throw nativeRefusal("not_served")
        return this.services.forModule(PLUGIN_TOOLS, { workspaceId, moduleKey, sees: "all" })
    }

    /** The facts of the run a plugin tool reads: the locked subject, the calling agent, the audience, the words of a context read and the lead memory. */
    private callOf(workspaceId: string, subject: LockedSubject, audience: ContextAudience, agentId: string | null): PluginToolCall {
        const { memory } = this
        const { leadId, conversationId } = subject
        return {
            conversationId,
            agentId,
            contactId: subject.contactId,
            leadId,
            audience,
            readNotice: CONTEXT_NOTICE,
            leadMemory:
                memory === undefined
                    ? null
                    : async () =>
                          leadId === null ? undefined : (await memory.snapshot(workspaceId, leadMemorySubjectOf(leadId, conversationId), "step"))?.lead,
        }
    }
}
