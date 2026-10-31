import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { BrainDossiersReadService } from "@modules/domain/brain-dossiers"
import type { DossierEntry } from "@modules/domain/brain-dossiers"
import { DossierFindingsService } from "@modules/domain/dossier-review"
import type { FindingRecord, ReviewSummary } from "@modules/domain/dossier-review"
import { McpGatewayErrorCode } from "@modules/domain/mcp-gateway"
import { DOSSIER_MANIFEST, DossierNativeService } from "./dossier-native.service"
import { nativeRefusal } from "./native-refusal.policy"
import { NativeViewService } from "./native-view.service"

const WS = "11111111-1111-4111-8111-111111111111"
const AGENT = { agentId: "a1", conversationId: null }

const entry = (changes: Partial<DossierEntry> = {}): DossierEntry => ({
    id: "d1",
    ref: "1.1",
    category: "Legal",
    categoryOrder: 1,
    position: 1,
    name: "Business licence",
    status: "missing",
    existing: "",
    missing: "",
    drafts: "",
    ...changes,
})

const summary = (changes: Partial<ReviewSummary> = {}): ReviewSummary => ({
    open: 3,
    confirmed: 1,
    critical: 1,
    high: 2,
    draftsAwaiting: 0,
    isRunning: false,
    latestRun: null,
    dossiers: [],
    ...changes,
})

const finding = (changes: Partial<FindingRecord> = {}): FindingRecord => ({
    id: "f1",
    dossierId: "d1",
    dossierRef: "1.1",
    dossierName: "Business licence",
    relatedDossierIds: [],
    kind: "missing",
    severity: "high",
    origin: "rule",
    code: "missing",
    params: [],
    title: "The licence is missing",
    detail: "A long detail that never leaves",
    evidence: [],
    remedyAction: "upload",
    remedyDocumentType: null,
    status: "open",
    resolution: null,
    dismissReason: null,
    decisionNote: null,
    reopenedCount: 0,
    assigneeId: null,
    dueAt: null,
    draftId: null,
    draftStatus: null,
    firstSeenAt: "2026-10-01T00:00:00.000Z",
    lastSeenAt: "2026-10-30T00:00:00.000Z",
    resolvedAt: null,
    decidedAt: null,
    createdAt: "2026-10-01T00:00:00.000Z",
    updatedAt: "2026-10-30T00:00:00.000Z",
    ...changes,
})

const build = async () => {
    const views = mock<NativeViewService>()
    views.internalOf.mockResolvedValue({
        workspaceId: WS,
        module: "sales",
        audience: "internal",
        installationId: null,
        searchable: true,
    })
    const dossiers = mock<BrainDossiersReadService>()
    dossiers.all.mockResolvedValue([entry(), entry({ id: "d2", ref: "1.2", name: "Tax code" })])
    const findings = mock<DossierFindingsService>()
    findings.summaryForAgent.mockResolvedValue(summary())
    findings.listForAgent.mockResolvedValue({
        nodes: [finding()],
        pageInfo: { endCursor: "c1", hasNextPage: true },
    })
    const moduleRef = await Test.createTestingModule({
        providers: [
            DossierNativeService,
            { provide: NativeViewService, useValue: views },
            { provide: BrainDossiersReadService, useValue: dossiers },
            { provide: DossierFindingsService, useValue: findings },
        ],
    }).compile()
    return { dossier: moduleRef.get(DossierNativeService), dossiers, findings, views }
}

describe("DossierNativeService manifest", () => {
    it("declares two read tools for internal use only", () => {
        expect(DOSSIER_MANIFEST.key).toBe("dossier")
        expect(
            DOSSIER_MANIFEST.tools.map((tool) => [tool.name, tool.scope, tool.internalOnly, tool.secretFields]),
        ).toEqual([
            ["status", "read", true, undefined],
            ["findings.list", "read", true, ["title"]],
        ])
    })
})

describe("DossierNativeService unknown tool and arguments", () => {
    it("refuses a tool the connector does not have", async () => {
        const { dossier } = await build()

        await expect(dossier.invoke(WS, "findings.delete", {}, AGENT)).rejects.toMatchObject({
            code: McpGatewayErrorCode.UnknownTool,
            params: { tool: "findings.delete" },
        })
    })

    it.each([
        ["status", { dossierId: "d1" }],
        ["findings.list", { first: 99 }],
    ])("refuses invalid arguments for %s before reading anything", async (tool, args) => {
        const { dossier, dossiers, findings } = await build()

        await expect(dossier.invoke(WS, tool, args, AGENT)).rejects.toMatchObject({
            code: McpGatewayErrorCode.InvalidArguments,
            params: { tool },
        })
        expect(dossiers.all).not.toHaveBeenCalled()
        expect(findings.listForAgent).not.toHaveBeenCalled()
    })
})

describe("DossierNativeService internal use", () => {
    it.each(["status", "findings.list"])(
        "refuses %s to a caller the view policy keeps out, before reading anything",
        async (tool) => {
            const { dossier, dossiers, findings, views } = await build()
            views.internalOf.mockRejectedValue(nativeRefusal("internal_only"))

            await expect(dossier.invoke(WS, tool, {}, { agentId: "a1", conversationId: "c1" })).rejects.toMatchObject({
                code: McpGatewayErrorCode.NativeRefused,
                params: { reason: "internal_only" },
            })
            expect(views.internalOf).toHaveBeenCalledWith(WS, { agentId: "a1", conversationId: "c1" })
            expect(dossiers.all).not.toHaveBeenCalled()
            expect(findings.listForAgent).not.toHaveBeenCalled()
        },
    )
})

describe("DossierNativeService status", () => {
    it("lists each dossier with its reviewed status and open findings, the totals and the last review", async () => {
        const { dossier, findings } = await build()
        findings.summaryForAgent.mockResolvedValue(
            summary({
                dossiers: [
                    {
                        dossierId: "d1",
                        status: "partial",
                        checklistStatus: "present",
                        openCount: 2,
                        criticalCount: 1,
                        highCount: 0,
                        reviewedAt: "2026-10-30T00:00:00.000Z",
                    },
                ],
                latestRun: {
                    id: "r1",
                    scope: "workspace",
                    dossierId: null,
                    trigger: "request",
                    status: "done",
                    aiState: "done",
                    opened: 2,
                    resolved: 0,
                    dropped: 0,
                    startedAt: "2026-10-30T00:00:00.000Z",
                    finishedAt: "2026-10-30T00:05:00.000Z",
                    createdAt: "2026-10-30T00:00:00.000Z",
                },
            }),
        )

        await expect(dossier.invoke(WS, "status", {}, AGENT)).resolves.toEqual({
            dossiers: [
                {
                    id: "d1",
                    ref: "1.1",
                    category: "Legal",
                    name: "Business licence",
                    status: "partial",
                    findingsOpen: 2,
                },
                { id: "d2", ref: "1.2", category: "Legal", name: "Tax code", status: "missing", findingsOpen: 0 },
            ],
            totals: { dossiers: 2, open: 3, confirmed: 1, critical: 1, high: 2 },
            latestRunAt: "2026-10-30T00:05:00.000Z",
        })
        expect(findings.summaryForAgent).toHaveBeenCalledWith(WS)
    })

    it("answers no last review before the first run, and the request time of a run that has not ended", async () => {
        const { dossier, findings } = await build()
        const first = await dossier.invoke(WS, "status", {}, AGENT)
        findings.summaryForAgent.mockResolvedValue(
            summary({
                latestRun: {
                    id: "r2",
                    scope: "workspace",
                    dossierId: null,
                    trigger: "request",
                    status: "running",
                    aiState: null,
                    opened: 0,
                    resolved: 0,
                    dropped: 0,
                    startedAt: null,
                    finishedAt: null,
                    createdAt: "2026-10-31T00:00:00.000Z",
                },
            }),
        )
        const running = await dossier.invoke(WS, "status", {}, AGENT)

        expect(first["latestRunAt"]).toBeNull()
        expect(running["latestRunAt"]).toBe("2026-10-31T00:00:00.000Z")
    })
})

describe("DossierNativeService findings.list", () => {
    it("lists a page without the detail, the evidence or the people, and keeps the cursor", async () => {
        const { dossier, findings } = await build()

        const answer = await dossier.invoke(
            WS,
            "findings.list",
            {
                dossierId: "11111111-1111-4111-8111-222222222222",
                statuses: ["open"],
                severities: ["high"],
                first: 5,
                after: "c0",
            },
            AGENT,
        )

        expect(answer).toEqual({
            findings: [
                {
                    id: "f1",
                    dossierId: "d1",
                    kind: "missing",
                    severity: "high",
                    status: "open",
                    title: "The licence is missing",
                    remedyAction: "upload",
                    lastSeenAt: "2026-10-30T00:00:00.000Z",
                },
            ],
            pageInfo: { endCursor: "c1", hasNextPage: true },
        })
        expect(findings.listForAgent).toHaveBeenCalledWith(
            WS,
            {
                dossierId: "11111111-1111-4111-8111-222222222222",
                statuses: ["open"],
                severities: ["high"],
                first: 5,
                after: "c0",
            },
            "vi",
        )
        expect(JSON.stringify(answer)).not.toContain("never leaves")
    })

    it("cuts a long title", async () => {
        const { dossier, findings } = await build()
        findings.listForAgent.mockResolvedValue({
            nodes: [finding({ title: "t".repeat(300) })],
            pageInfo: { endCursor: null, hasNextPage: false },
        })

        const answer = await dossier.invoke(WS, "findings.list", {}, AGENT)

        expect(JSON.stringify(answer)).toContain(`"${"t".repeat(199)}…"`)
    })
})
