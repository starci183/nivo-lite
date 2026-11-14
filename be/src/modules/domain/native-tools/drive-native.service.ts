import { Injectable } from "@nestjs/common"
import { KnowledgeSourcesReadService, type OriginSource } from "@modules/domain/knowledge-sources"
import {
    type ToolJson,
    type NativeToolFamily,
    type NativeCaller,
    type ToolManifest,
    argumentsOf,
    unknownTool,
} from "@modules/domain/tools"
import {
    DRIVE_SOURCES_LIST_INPUT_SCHEMA,
    DRIVE_SOURCES_LIST_SCHEMA,
    DRIVE_STATUS_INPUT_SCHEMA,
    DRIVE_STATUS_SCHEMA,
    type DriveSourcesListInput,
} from "./drive-native.schema"
import { soleAccountOf } from "./native-account.policy"
import { emailMasked } from "./native-masking.policy"
import { nativeRefusal } from "./native-refusal.policy"
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

/**
 * The Drive connector: whether the grant holds and what the Drive fed into the Brain, internal use only. Its tools are the platform's
 * purposes `nivo.tool.drive.status.get` and `nivo.tool.drive.source.list` (`TOOL.driveSourceList`), the Google Drive grant their one adapter;
 * the connector row key stays `drive`, which also gives its reads the data kind `documents`.
 */
export const DRIVE_MANIFEST: ToolManifest = {
    key: "drive",
    namespace: "nivo.tool.drive",
    name: "Google Drive",
    contractVersion: "drive-native@1",
    tools: [
        {
            name: "status.get",
            description:
                "Whether Google Drive is connected for the business, the account masked, and how many of its files are ready, being read or failed.",
            scope: "read",
            defaultMode: "auto",
            inputSchema: DRIVE_STATUS_INPUT_SCHEMA,
            argumentSchema: DRIVE_STATUS_SCHEMA,
            internalOnly: true,
        },
        {
            name: "source.list",
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
interface SourceCounts {
    readonly ready: number
    readonly working: number
    readonly failed: number
}

const countsOf = (sources: ReadonlyArray<OriginSource>): SourceCounts => ({
    ready: sources.filter((source) => source.status === "ready").length,
    working: sources.filter((source) => source.status !== "ready" && !FAILED.has(source.status)).length,
    failed: sources.filter((source) => FAILED.has(source.status)).length,
})

@Injectable()
/**
 * Runs the Drive tools. Drive content is never read live through a tool: it enters the Brain as sources and is read with
 * `nivo.tool.brain.search`. These tools say whether the grant holds and where the files fed in stand; the account leaves masked.
 */
export class DriveNativeService implements NativeToolFamily {
    readonly manifest: ToolManifest = DRIVE_MANIFEST

    constructor(
        private readonly views: NativeViewService,
        private readonly tools: ProviderToolsService,
        private readonly sources: KnowledgeSourcesReadService,
    ) {}

    /** Runs one Drive tool. */
    async invoke(workspaceId: string, tool: string, args: ToolJson, caller: NativeCaller): Promise<ToolJson> {
        await this.views.internalOf(workspaceId, caller)
        if (tool === "status.get") {
            argumentsOf(tool, DRIVE_STATUS_SCHEMA, args)
            return this.status(workspaceId, caller)
        }
        if (tool === "source.list") {
            return this.list(workspaceId, argumentsOf(tool, DRIVE_SOURCES_LIST_SCHEMA, args))
        }
        throw unknownTool(tool)
    }

    /**
     * The state of the Drive grant, never the first grant's by accident (ARCH-REVIEW 2026-11-12 S7): the grant the tool runner handed
     * (`not_connected` when it is not there); else the ONE grant of the workspace (`soleAccountOf`: several are `not_selected`).
     */
    private async status(workspaceId: string, caller: NativeCaller): Promise<ToolJson> {
        const grants = await this.tools.connectionsOf(workspaceId, PROVIDER)
        const handed = caller.connectionId
        const grant =
            handed === undefined ? soleAccountOf(grants) : grants.find((one) => one.id === handed)
        if (grant === undefined) throw nativeRefusal("not_connected")
        const sources = await this.sources.ofOrigin(workspaceId, ORIGIN, SOURCES_WINDOW)
        return {
            state: grant.status,
            accountMasked: emailMasked(grant.email),
            rawBytesUsed: sources.reduce((total, source) => total + source.sizeBytes, 0),
            sources: countsOf(sources),
        }
    }

    private async list(workspaceId: string, input: DriveSourcesListInput): Promise<ToolJson> {
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
