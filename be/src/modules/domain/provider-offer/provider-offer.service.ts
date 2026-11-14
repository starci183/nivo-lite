import { Injectable, Optional } from "@nestjs/common"
import { ConnectionBindingsReadService } from "@modules/domain/connections"
import { INSTALLED } from "@modules/domain/installed-plugins"
import {
    ToolRegistryService,
    PROVIDER_CATALOGUE,
    toolNameOf,
    type WorkspaceToolFamily,
} from "@modules/domain/tools"
import { OPENAPI_PROVIDER, OPENAPI_SOURCE_KEYS, installedDeclarationsOf, sourceOfTool } from "@modules/domain/openapi-tools"
import { triggersOf } from "@modules/domain/provider-triggers"
import { INTERFACE_READ_PROVIDERS, apiVerbOfRead, type InterfaceReadProvider } from "@modules/domain/workbench-door"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { WorkspaceEnterpriseService } from "@modules/domain/workspaces"
import { injector } from "@modules/platform/composition"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import { ProviderOfferError, ProviderOfferErrorCode } from "./errors/provider-offer.error"
import { ProviderOfferLogEvent } from "./provider-offer.log-events"
import type { OfferWords, OfferedRead, OfferedTool, ProviderOffer, ProviderOfferActor } from "./provider-offer.contracts"
import {
    infoReadOf,
    interfaceReadOf,
    offeredToolOf,
    offeredTriggersOf,
    swaggerPinOf,
    swaggerReadsOf,
    type SwaggerPin,
    type ToolSource,
} from "./provider-offer.policy"
import { jsonSchemaOf } from "./provider-offer.schema"

/** One tool spec a connector of the gateway registers. */
type GatewaySpec = WorkspaceToolFamily["manifest"]["tools"][number]

/** Every tool spec the gateway registers for the workspace, by full tool name (`<namespace or key>.<tool>`). */
const specsByName = (connectors: ReadonlyArray<WorkspaceToolFamily>): ReadonlyMap<string, GatewaySpec> =>
    new Map(
        connectors.flatMap((connector) =>
            connector.manifest.tools.map((spec): readonly [string, GatewaySpec] => [toolNameOf(connector.manifest, spec.name), spec]),
        ),
    )

/** Words in the owner's two languages, copied; null when there are none. */
const wordsOf = (words: OfferWords | null | undefined): OfferWords | null =>
    words === null || words === undefined ? null : { vi: words.vi, en: words.en }

/** The sources the given tools use, by the static rule: a tool `nivo.tool.<key>.…` of a source the installed plugins declare uses `<key>`. */
const sourcesOf = (tools: ReadonlySet<string>): ReadonlySet<string> =>
    new Set([...tools].flatMap((tool) => sourceOfTool(tool, OPENAPI_SOURCE_KEYS) ?? []))

@Injectable()
/**
 * WHAT A PROVIDER OFFERS, for the provider page of one connected account: its level-1 reads (the interface-read registry; for the
 * OpenAPI provider, generated from the PINNED document stored on the connection), its level-2 tools (the rights catalogue's tools with
 * the gateway's specs, the plugins' declarations and, for the OpenAPI provider, how each stands against the pinned document) and its
 * level-3 triggers (the trigger catalogue). Documentation only: no read is run, nothing outside is called, no figure of the account is
 * returned. Any member of the workspace may read it; the account must be the workspace's own.
 */
export class ProviderOfferService {
    constructor(
        @InjectLogger() private readonly logger: Logger,
        private readonly members: WorkspaceMembersService,
        private readonly bindings: ConnectionBindingsReadService,
        @Optional() private readonly gateway?: ToolRegistryService,
        @Optional() @injector<ReadonlyArray<InterfaceReadProvider>>(INTERFACE_READ_PROVIDERS)
        private readonly readers?: ReadonlyArray<InterfaceReadProvider>,
        @Optional() private readonly enterprise?: WorkspaceEnterpriseService,
    ) {}

    /** What the provider of the account offers at its three levels; refused for a non-member and for an account of no such id. */
    async offerOf(actor: ProviderOfferActor, connectionId: string): Promise<ProviderOffer> {
        await this.members.require(actor.principalId, actor.workspaceId)
        const record = await this.bindings.recordOf(actor.workspaceId, connectionId)
        if (record === null) {
            throw new ProviderOfferError({ code: ProviderOfferErrorCode.ConnectionNotFound, params: { connectionId } })
        }
        const { provider } = record
        const swagger = provider === OPENAPI_PROVIDER
        const pin = swagger ? swaggerPinOf(record.meta, installedDeclarationsOf) : null
        const open = swagger ? await this.openToolsOf(actor.workspaceId) : new Set<string>()
        return {
            connectionId,
            provider,
            api: await this.apiOf(actor.workspaceId, provider, pin, sourcesOf(open)),
            mcp: this.mcpOf(provider, pin, open),
            triggers: offeredTriggersOf(triggersOf(provider)),
        }
    }

    /** Level 1: `info` when the provider draws an account's state, then its named reads (generated from the pin for OpenAPI). */
    private async apiOf(
        workspaceId: string,
        provider: string,
        pin: SwaggerPin | null,
        openSources: ReadonlySet<string>,
    ): Promise<ReadonlyArray<OfferedRead>> {
        const reader = (this.readers ?? []).find((entry) => entry.provider === provider)
        if (reader === undefined) return []
        // Only what the door serves: a core read through the level-1 registry (total over `API`), the carrier's from its pin.
        const infoVerb = apiVerbOfRead({ provider, read: "info" })
        const info = reader.infoOf === undefined || infoVerb === null ? [] : [infoReadOf(infoVerb)]
        // The OpenAPI provider's own `readsOf` checks the live document at the outside system; the page documents the pinned one.
        if (provider === OPENAPI_PROVIDER) return [...info, ...(pin === null ? [] : swaggerReadsOf(pin, openSources))]
        const freshness = reader.freshness ?? "live"
        const reads = await reader.readsOf(workspaceId)
        return [
            ...info,
            ...reads.flatMap((read) => {
                const verb = apiVerbOfRead({ provider, read: read.name })
                return verb === null ? [] : [interfaceReadOf(verb, read, freshness)]
            }),
        ]
    }

    /** Level 2: every tool the provider's abilities hold, once, described by what the registries declare of it. */
    private mcpOf(provider: string, pin: SwaggerPin | null, open: ReadonlySet<string>): ReadonlyArray<OfferedTool> {
        const spec = PROVIDER_CATALOGUE.find((entry) => entry.provider === provider)
        if (spec === undefined) return []
        const specs = specsByName(this.gateway?.familiesOf() ?? [])
        const seen = new Set<string>()
        return spec.abilities.flatMap((ability) =>
            ability.tools.flatMap((id): ReadonlyArray<OfferedTool> => {
                if (seen.has(id) || !this.offered(provider, id, pin, open)) return []
                seen.add(id)
                return [offeredToolOf(this.sourceOf(id, ability.scope, specs.get(id) ?? null, pin))]
            }),
        )
    }

    /** False for a Swagger tool no plugin open to the workspace declares, or one the account's connector does not serve. */
    private offered(provider: string, id: string, pin: SwaggerPin | null, open: ReadonlySet<string>): boolean {
        if (provider !== OPENAPI_PROVIDER) return true
        return open.has(id) && (pin === null || pin.declarations.some((declaration) => declaration.tool === id))
    }

    /** What the gateway spec, the plugin's definition and label, and the pin declare of one tool. */
    private sourceOf(
        id: string,
        abilityScope: "read" | "write",
        spec: GatewaySpec | null,
        pin: SwaggerPin | null,
    ): ToolSource {
        const definition = INSTALLED.toolOf(id)
        const label = INSTALLED.toolLabelOf(id)
        const definedTitle = definition !== null && "vi" in definition.title ? definition.title : null
        return {
            id,
            abilityScope,
            specScope: spec?.scope ?? null,
            description: spec?.description ?? null,
            inputSchema: spec?.inputSchema ?? null,
            argsSchema: definition === null ? null : this.drawn(id, "args", definition.args),
            resultSchema: definition === null ? null : this.drawn(id, "result", definition.result),
            mutates: definition?.mutates ?? null,
            title: wordsOf(label?.title ?? definedTitle),
            summary: wordsOf(label?.summary),
            pinned: pin?.states.find((state) => state.tool === id) ?? null,
            declaredEffect: spec?.effect ?? null,
        }
    }

    /** A tool's declared schema as JSON Schema; one zod cannot draw is logged and documented as no members. */
    private drawn(tool: string, part: "args" | "result", schema: Parameters<typeof jsonSchemaOf>[0]): unknown {
        const drawing = jsonSchemaOf(schema)
        if (drawing.ok) return drawing.schema
        this.logger.warn(ProviderOfferLogEvent.SchemaUndrawable, { tool, part, error: drawing.cause instanceof Error ? drawing.cause.name : typeof drawing.cause })
        return null
    }

    /** The tools the plugins open to the workspace declare for their agents (a private plugin: only its enterprise's workspaces). */
    private async openToolsOf(workspaceId: string): Promise<ReadonlySet<string>> {
        const key = this.enterprise === undefined ? null : await this.enterprise.keyOf(workspaceId)
        const modules = INSTALLED.plugins.flatMap((plugin) => plugin.modules).filter((module) => INSTALLED.isOpenTo(module, key))
        return new Set(modules.flatMap((module) => INSTALLED.agentToolsOf(module) ?? []))
    }
}
