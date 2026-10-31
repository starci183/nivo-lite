import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import type { ConnectionStatusFacts } from "@modules/domain/connections"
import { KnowledgeSourcesReadService } from "@modules/domain/knowledge-sources"
import type { OriginSource } from "@modules/domain/knowledge-sources"
import { McpGatewayErrorCode } from "@modules/domain/mcp-gateway"
import { summaryOf } from "@modules/domain/mcp-gateway/audit-mask.policy"
import { DRIVE_MANIFEST, DriveNativeService } from "./drive-native.service"
import { nativeRefusal } from "./native-refusal.policy"
import { ProviderToolsService } from "./provider-tools.service"

const WS = "11111111-1111-4111-8111-111111111111"

const grant = (changes: Partial<ConnectionStatusFacts> = {}): ConnectionStatusFacts => ({
    id: "c1",
    provider: "google_drive",
    name: "Google Drive - lan.nguyen@shop.vn",
    status: "connected",
    createdAt: new Date("2026-10-01T00:00:00.000Z"),
    botUsername: null,
    accountMasked: null,
    lastError: null,
    oaId: null,
    email: "lan.nguyen@shop.vn",
    ...changes,
})

const source = (changes: Partial<OriginSource> = {}): OriginSource => ({
    id: "s1",
    title: "Bang gia thang 11",
    status: "ready",
    visibility: "public",
    sizeBytes: 1000,
    updatedAt: "2026-10-30T00:00:00.000Z",
    ...changes,
})

const build = async () => {
    const tools = mock<ProviderToolsService>()
    tools.connectionsOf.mockResolvedValue([grant()])
    const sources = mock<KnowledgeSourcesReadService>()
    sources.ofOrigin.mockResolvedValue([
        source(),
        source({ id: "s2", status: "indexing", sizeBytes: 500 }),
        source({ id: "s3", status: "failed", sizeBytes: 250 }),
        source({ id: "s4", status: "blocked_credits", sizeBytes: 250 }),
        source({ id: "s5", status: "queued", sizeBytes: 0 }),
    ])
    const moduleRef = await Test.createTestingModule({
        providers: [
            DriveNativeService,
            { provide: ProviderToolsService, useValue: tools },
            { provide: KnowledgeSourcesReadService, useValue: sources },
        ],
    }).compile()
    return { drive: moduleRef.get(DriveNativeService), tools, sources }
}

describe("DriveNativeService manifest", () => {
    it("declares two read tools for internal use only", () => {
        expect(DRIVE_MANIFEST.key).toBe("drive")
        expect(DRIVE_MANIFEST.tools.map((tool) => [tool.name, tool.scope, tool.internalOnly, tool.secretFields])).toEqual(
            [
                ["status", "read", true, undefined],
                ["sources.list", "read", true, ["title"]],
            ],
        )
    })
})

describe("DriveNativeService unknown tool and arguments", () => {
    it("refuses a tool the connector does not have", async () => {
        const { drive } = await build()

        await expect(drive.invoke(WS, "files.read", {})).rejects.toMatchObject({
            code: McpGatewayErrorCode.UnknownTool,
            params: { tool: "files.read" },
        })
    })

    it.each([
        ["status", { status: "ready" }],
        ["sources.list", { limit: 51 }],
    ])("refuses invalid arguments for %s before reading anything", async (tool, args) => {
        const { drive, tools, sources } = await build()

        await expect(drive.invoke(WS, tool, args)).rejects.toMatchObject({
            code: McpGatewayErrorCode.InvalidArguments,
            params: { tool },
        })
        expect(tools.connectionsOf).not.toHaveBeenCalled()
        expect(sources.ofOrigin).not.toHaveBeenCalled()
    })
})

describe("DriveNativeService status", () => {
    it("answers the grant state, the account masked, the bytes and the sources by stage", async () => {
        const { drive, tools, sources } = await build()

        const answer = await drive.invoke(WS, "status", {})

        expect(answer).toEqual({
            state: "connected",
            accountMasked: "l***@shop.vn",
            rawBytesUsed: 2000,
            sources: { ready: 1, working: 2, failed: 2 },
        })
        expect(JSON.stringify(answer)).not.toContain("lan.nguyen")
        expect(tools.connectionsOf).toHaveBeenCalledWith(WS, "google_drive")
        expect(sources.ofOrigin).toHaveBeenCalledWith(WS, "google_drive", 500)
    })

    it("says a grant that stopped working is in error, and shows no account when none was reported", async () => {
        const { drive, tools } = await build()
        tools.connectionsOf.mockResolvedValue([grant({ status: "error", email: null })])

        await expect(drive.invoke(WS, "status", {})).resolves.toMatchObject({ state: "error", accountMasked: "" })
    })

    it("reads an empty list of grants as not connected too, before reading any source", async () => {
        const { drive, tools, sources } = await build()
        tools.connectionsOf.mockResolvedValue([])

        await expect(drive.invoke(WS, "status", {})).rejects.toMatchObject({ params: { reason: "not_connected" } })
        expect(sources.ofOrigin).not.toHaveBeenCalled()
    })

    it("is refused as not connected for a workspace with no Drive grant, before reading any source", async () => {
        const { drive, tools, sources } = await build()
        tools.connectionsOf.mockRejectedValue(nativeRefusal("not_connected"))

        await expect(drive.invoke(WS, "status", {})).rejects.toMatchObject({
            code: McpGatewayErrorCode.NativeRefused,
            params: { reason: "not_connected" },
        })
        expect(sources.ofOrigin).not.toHaveBeenCalled()
    })
})

describe("DriveNativeService sources.list", () => {
    it("lists the sources of the Drive origin, bounded, without text", async () => {
        const { drive, sources } = await build()

        const answer = await drive.invoke(WS, "sources.list", { status: "ready", limit: 1 })

        expect(answer).toEqual({
            sources: [
                {
                    id: "s1",
                    title: "Bang gia thang 11",
                    status: "ready",
                    visibility: "public",
                    updatedAt: "2026-10-30T00:00:00.000Z",
                },
            ],
        })
        expect(sources.ofOrigin).toHaveBeenCalledWith(WS, "google_drive", 500)
        expect(summaryOf(answer, DRIVE_MANIFEST.tools[1]?.secretFields)).not.toContain("Bang gia")
    })

    it("lists every stage up to the default limit when none is asked for, and needs the grant", async () => {
        const { drive, tools, sources } = await build()
        sources.ofOrigin.mockResolvedValue(
            Array.from({ length: 30 }, (_, index) => source({ id: `s${String(index)}`, status: "queued" })),
        )

        const answer = await drive.invoke(WS, "sources.list", {})

        expect(tools.connectionsOf).toHaveBeenCalledWith(WS, "google_drive")
        expect(answer["sources"]).toHaveLength(20)
    })

    it("keeps to the stage asked for", async () => {
        const { drive } = await build()

        const answer = await drive.invoke(WS, "sources.list", { status: "failed" })

        expect(answer).toMatchObject({ sources: [{ id: "s3", status: "failed" }] })
    })

    it("is refused as not connected for a workspace with no Drive grant", async () => {
        const { drive, tools, sources } = await build()
        tools.connectionsOf.mockRejectedValue(nativeRefusal("not_connected"))

        await expect(drive.invoke(WS, "sources.list", {})).rejects.toMatchObject({
            params: { reason: "not_connected" },
        })
        expect(sources.ofOrigin).not.toHaveBeenCalled()
    })
})
