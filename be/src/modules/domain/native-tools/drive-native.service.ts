import { Injectable } from "@nestjs/common"
import { KnowledgeSourcesReadService } from "@modules/domain/knowledge-sources"
import type { OriginSource } from "@modules/domain/knowledge-sources"
import type { GatewayJson, NativeAdapter, NativeCaller, NativeConnectorManifest } from "@modules/domain/mcp-gateway"
import {
    DRIVE_SOURCES_LIST_INPUT_SCHEMA,
    DRIVE_SOURCES_LIST_SCHEMA,
    DRIVE_STATUS_INPUT_SCHEMA,
    DRIVE_STATUS_SCHEMA,
} from "./drive-native.schema"
import type { DriveSourceStatus } from "./drive-native.schema"
import { emailMasked } from "./native-masking.policy"
import { argumentsOf, nativeRefusal, unknownTool } from "./native-refusal.policy"
import { NativeViewService } from "./native-view.service"
import { ProviderToolsService } from "./provider-tools.service"

/** The provider of the Drive grant of a workspace. */
const PROVIDER = "google_drive"

/** The origin the Drive files are added to the Brain under. */
const ORIGIN = "google_drive"

/** How many sources the counts look across. */
const SOURCES_WINDOW = 500

/** The stages of a source that mean it failed to be read. */
const FAILED: ReadonlySet<string> = new Set(["failed", "blocked_credits"])

/** The Google Drive native connector: whether the grant holds and what the Drive fed into the Brain. Internal use only. */
export const DRIVE_MANIFEST: NativeConnectorManifest = {
    key: "drive",
    name: "Google Drive",
    kind: "native",
    contractVersion: "drive-native@1",
    tools: [
        {
            name: "status",
            description:
                "Whether Google Drive is connected for the business, the account masked, and how many of its files are ready, being read or failed.",
            scope: "read",
            defaultMode: "auto",
            inputSchema: DRIVE_STATUS_INPUT_SCHEMA,
            argumentSchema: DRIVE_STATUS_SCHEMA,
            internalOnly: true,
        },
        {
            name: "sources.list",
            description: "The files the Drive fed into the Brain, newest change first: stage, visibility and when.",
            scope: "read",
            defaultMode: "auto",
            inputSchema: DRIVE_SOURCES_LIST_INPUT_SCHEMA,
            argumentSchema: DRIVE_SOURCES_LIST_SCHEMA,
            secretFields: ["title"],
            internalOnly: true,
        },
    ],
}

/** How many of the sources are ready, being read, and failed. */
const countsOf = (sources: ReadonlyArray<OriginSource>): { ready: number; working: number; failed: number } => ({
    ready: sources.filter((source) => source.status === "ready").length,
    working: sources.filter((source) => source.status !== "ready" && !FAILED.has(source.status)).length,
    failed: sources.filter((source) => FAILED.has(source.status)).length,
})

@Injectable()
/**
 * Runs the Drive tools. Drive content is never read live through a tool: it enters the Brain as sources and is read with
 * `brain.search`. These tools say whether the grant holds and where the files fed in stand; the account leaves masked.
 */
export class DriveNativeService implements NativeAdapter {
    readonly manifest = DRIVE_MANIFEST

    constructor(
        private readonly views: NativeViewService,
        private readonly tools: ProviderToolsService,
        private readonly sources: KnowledgeSourcesReadService,
    ) {}

    /** Runs one Drive tool. */
    async invoke(workspaceId: string, tool: string, args: GatewayJson, caller: NativeCaller): Promise<GatewayJson> {
        await this.views.internalOf(workspaceId, caller)
        if (tool === "status") {
            argumentsOf(tool, DRIVE_STATUS_SCHEMA, args)
            return this.status(workspaceId)
        }
        if (tool === "sources.list") {
            return this.list(workspaceId, argumentsOf(tool, DRIVE_SOURCES_LIST_SCHEMA, args))
        }
        throw unknownTool(tool)
    }

    private async status(workspaceId: string): Promise<GatewayJson> {
        const [grant] = await this.tools.connectionsOf(workspaceId, PROVIDER)
        if (grant === undefined) throw nativeRefusal("not_connected")
        const sources = await this.sources.ofOrigin(workspaceId, ORIGIN, SOURCES_WINDOW)
        return {
            state: grant.status,
            accountMasked: emailMasked(grant.email),
            rawBytesUsed: sources.reduce((total, source) => total + source.sizeBytes, 0),
            sources: countsOf(sources),
        }
    }

    private async list(
        workspaceId: string,
        input: { readonly status?: DriveSourceStatus | undefined; readonly limit: number },
    ): Promise<GatewayJson> {
        await this.tools.connectionsOf(workspaceId, PROVIDER)
        const sources = await this.sources.ofOrigin(workspaceId, ORIGIN, SOURCES_WINDOW)
        return {
            sources: sources
                .filter((source) => input.status === undefined || source.status === input.status)
                .slice(0, input.limit)
                .map((source) => ({
                    id: source.id,
                    title: source.title,
                    status: source.status,
                    visibility: source.visibility,
                    updatedAt: source.updatedAt,
                })),
        }
    }
}
