import { Injectable } from "@nestjs/common"
import { BrainDossiersReadService } from "@modules/domain/brain-dossiers"
import { DossierFindingsService } from "@modules/domain/dossier-review"
import type { GatewayJson, NativeAdapter, NativeCaller, NativeConnectorManifest } from "@modules/domain/mcp-gateway"
import {
    DOSSIER_FINDINGS_LIST_INPUT_SCHEMA,
    DOSSIER_FINDINGS_LIST_SCHEMA,
    DOSSIER_STATUS_INPUT_SCHEMA,
    DOSSIER_STATUS_SCHEMA,
} from "./dossier-native.schema"
import { clipped } from "./native-masking.policy"
import { argumentsOf, unknownTool } from "./native-refusal.policy"
import { NativeViewService } from "./native-view.service"

/** The longest finding title a tool answers, in characters. */
const TITLE_CHARS = 200

/** The language rule findings are worded in: the product's own. */
const LOCALE = "vi"

/** The dossier native connector: where the dossiers of the Second Brain stand and what the review found. Internal use only. */
export const DOSSIER_MANIFEST: NativeConnectorManifest = {
    key: "dossier",
    name: "Dossiers",
    kind: "native",
    contractVersion: "dossier-native@1",
    tools: [
        {
            name: "status",
            description: "Where the dossiers of the business stand: each one's status and open findings, the totals and the last review.",
            scope: "read",
            defaultMode: "auto",
            inputSchema: DOSSIER_STATUS_INPUT_SCHEMA,
            argumentSchema: DOSSIER_STATUS_SCHEMA,
            internalOnly: true,
        },
        {
            name: "findings.list",
            description:
                "A page of what the dossier review found, the most severe first; filter by dossier, status and severity.",
            scope: "read",
            defaultMode: "auto",
            inputSchema: DOSSIER_FINDINGS_LIST_INPUT_SCHEMA,
            argumentSchema: DOSSIER_FINDINGS_LIST_SCHEMA,
            secretFields: ["title"],
            internalOnly: true,
        },
    ],
}

@Injectable()
/**
 * Runs the dossier tools for a workspace. They are for internal use: no customer conversation reaches them (the gateway hides them),
 * and an agent whose view is the customer's is refused `internal_only` even when it holds a key outside a conversation.
 */
export class DossierNativeService implements NativeAdapter {
    readonly manifest = DOSSIER_MANIFEST

    constructor(
        private readonly views: NativeViewService,
        private readonly dossiers: BrainDossiersReadService,
        private readonly findings: DossierFindingsService,
    ) {}

    /** Runs one dossier tool. */
    async invoke(workspaceId: string, tool: string, args: GatewayJson, caller: NativeCaller): Promise<GatewayJson> {
        if (tool === "status") {
            argumentsOf(tool, DOSSIER_STATUS_SCHEMA, args)
            await this.admit(workspaceId, caller)
            return this.status(workspaceId)
        }
        if (tool === "findings.list") {
            const input = argumentsOf(tool, DOSSIER_FINDINGS_LIST_SCHEMA, args)
            await this.admit(workspaceId, caller)
            return this.list(workspaceId, input)
        }
        throw unknownTool(tool)
    }

    /** Refuses a conversation and an agent whose view is the customer's. */
    private async admit(workspaceId: string, caller: NativeCaller): Promise<void> {
        await this.views.internalOf(workspaceId, caller)
    }

    private async status(workspaceId: string): Promise<GatewayJson> {
        const [entries, summary] = await Promise.all([
            this.dossiers.all(workspaceId),
            this.findings.summaryForAgent(workspaceId),
        ])
        const reviewed = new Map(summary.dossiers.map((review) => [review.dossierId, review]))
        return {
            dossiers: entries.map((entry) => ({
                id: entry.id,
                ref: entry.ref,
                category: entry.category,
                name: entry.name,
                status: reviewed.get(entry.id)?.status ?? entry.status,
                findingsOpen: reviewed.get(entry.id)?.openCount ?? 0,
            })),
            totals: {
                dossiers: entries.length,
                open: summary.open,
                confirmed: summary.confirmed,
                critical: summary.critical,
                high: summary.high,
            },
            latestRunAt: summary.latestRun === null ? null : (summary.latestRun.finishedAt ?? summary.latestRun.createdAt),
        }
    }

    private async list(
        workspaceId: string,
        input: {
            readonly dossierId?: string | undefined
            readonly statuses?: ReadonlyArray<string> | undefined
            readonly severities?: ReadonlyArray<string> | undefined
            readonly first: number
            readonly after?: string | undefined
        },
    ): Promise<GatewayJson> {
        const page = await this.findings.listForAgent(workspaceId, input, LOCALE)
        return {
            findings: page.nodes.map((finding) => ({
                id: finding.id,
                dossierId: finding.dossierId,
                kind: finding.kind,
                severity: finding.severity,
                status: finding.status,
                title: clipped(finding.title, TITLE_CHARS),
                remedyAction: finding.remedyAction,
                lastSeenAt: finding.lastSeenAt,
            })),
            pageInfo: { endCursor: page.pageInfo.endCursor, hasNextPage: page.pageInfo.hasNextPage },
        }
    }
}
