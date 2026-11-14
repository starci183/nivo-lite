import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { isRecord } from "@modules/platform/primitives"
import { ConnectionsService, type ConnectionRecord } from "@modules/domain/connections"
import type { NativeCaller } from "@modules/domain/tools"
import { providerRefusal, TiktokPublishRegistryService } from "@modules/domain/provider-registry"
import type { TiktokPublishPort } from "@modules/domain/provider-registry"
import { connectionRecord } from "@tests/fixtures/builders/connection-records.builder"
import { SOCIAL_BUSINESS_REFUSALS, SOCIAL_REFUSALS, SOCIAL_REFUSAL_CLASS } from "./social-refusal.policy"
import { TIKTOK_VIDEO_PUBLISH_SCHEMA, TIKTOK_VIDEO_STATUS_GET_SCHEMA } from "./tiktok-native.schema"
import { TIKTOK_MANIFEST, TIKTOK_TOOL, TiktokNativeService } from "./tiktok-native.service"

const ACCOUNT = connectionRecord({ id: "conn-1", workspaceId: "ws-1", provider: "tiktok", name: "TikTok", meta: {} })
const caller = (connectionId?: string): NativeCaller =>
    ({ agentId: "agent-1", conversationId: null, ...(connectionId === undefined ? {} : { connectionId, provider: "tiktok" }) })

const build = async (found: ConnectionRecord | null = ACCOUNT) => {
    const connections = mock<ConnectionsService>()
    connections.find.mockResolvedValue(found)
    const port = mock<TiktokPublishPort>({ provider: "tiktok" })
    const moduleRef = await Test.createTestingModule({
        providers: [TiktokNativeService, TiktokPublishRegistryService, { provide: ConnectionsService, useValue: connections }],
    }).compile()
    moduleRef.get(TiktokPublishRegistryService).register(port)
    return { service: moduleRef.get(TiktokNativeService), port }
}

const reasonOf = (work: Promise<unknown>): Promise<unknown> =>
    Promise.resolve(work.then(
        () => null,
        (cause: unknown) => (isRecord(cause) && isRecord(cause["params"]) ? (cause["params"]["reason"] ?? cause) : cause),
    ))

describe("the TikTok manifest", () => {
    it("names every tool by its destination domain under nivo.tool, internal only; the write asks first, the reads run", () => {
        expect(TIKTOK_MANIFEST.tools.map((tool) => tool.domain)).toEqual([
            "nivo.tool.tiktok.video.publish",
            "nivo.tool.tiktok.video.status.get",
            "nivo.tool.tiktok.creator.info.get",
        ])
        expect(TIKTOK_MANIFEST.tools.map((tool) => `${TIKTOK_MANIFEST.namespace}.${tool.name}`)).toEqual(TIKTOK_MANIFEST.tools.map((tool) => tool.domain))
        expect(TIKTOK_MANIFEST.tools.map((tool) => [tool.scope, tool.defaultMode, tool.internalOnly])).toEqual([
            ["write", "ask", true],
            ["read", "auto", true],
            ["read", "auto", true],
        ])
    })

    it("lists the business refusals inside the refusals every tool answers", () => {
        for (const reason of SOCIAL_BUSINESS_REFUSALS) expect(SOCIAL_REFUSALS).toContain(reason)
        for (const reason of SOCIAL_REFUSALS) {
            expect(SOCIAL_REFUSAL_CLASS[reason] === "business").toBe(SOCIAL_BUSINESS_REFUSALS.some((business) => business === reason))
        }
    })
})

describe("the TikTok schemas (bounds from the documentation)", () => {
    const ok = { videoUrl: "https://cdn.example.com/v.mp4", privacyLevel: "SELF_ONLY" }

    it("accepts the documented members", () => {
        expect(TIKTOK_VIDEO_PUBLISH_SCHEMA.safeParse({ ...ok, title: "x".repeat(2200), disableDuet: true, coverTimestampMs: 2_147_483_647 }).success).toBe(true)
    })

    it.each([
        ["a caption over 2200", { ...ok, title: "x".repeat(2201) }],
        ["an unknown privacy level", { ...ok, privacyLevel: "FRIENDS" }],
        ["a negative cover frame", { ...ok, coverTimestampMs: -1 }],
        ["a cover frame over int32", { ...ok, coverTimestampMs: 2_147_483_648 }],
        ["an http address", { ...ok, videoUrl: "http://cdn.example.com/v.mp4" }],
        ["an unknown member", { ...ok, duration: 5 }],
        ["no privacy level", { videoUrl: ok.videoUrl }],
    ])("refuses %s", (_name, value) => {
        expect(TIKTOK_VIDEO_PUBLISH_SCHEMA.safeParse(value).success).toBe(false)
    })

    it("bounds the publish id to 64 characters", () => {
        expect(TIKTOK_VIDEO_STATUS_GET_SCHEMA.safeParse({ publishId: "p".repeat(64) }).success).toBe(true)
        expect(TIKTOK_VIDEO_STATUS_GET_SCHEMA.safeParse({ publishId: "p".repeat(65) }).success).toBe(false)
    })
})

describe("TiktokNativeService", () => {
    it("publishes through the handed account's port, mapping absent members to null", async () => {
        const { service, port } = await build()
        port.publish.mockResolvedValue({ publishId: "v_pub_url~1" })

        await expect(
            service.invoke("ws-1", TIKTOK_TOOL.videoPublish, { videoUrl: "https://cdn.example.com/v.mp4", privacyLevel: "SELF_ONLY", disableComment: true }, caller("conn-1")),
        ).resolves.toEqual({ publishId: "v_pub_url~1" })
        expect(port.publish).toHaveBeenCalledWith(ACCOUNT, {
            source: { kind: "url", videoUrl: "https://cdn.example.com/v.mp4" },
            privacyLevel: "SELF_ONLY",
            title: null,
            disableDuet: null,
            disableStitch: null,
            disableComment: true,
            coverTimestampMs: null,
            brandContentToggle: null,
            brandOrganicToggle: null,
            isAigc: null,
        })
    })

    it("answers the status and the creator", async () => {
        const { service, port } = await build()
        port.status.mockResolvedValue({ publishId: "p", state: "published", providerStatus: "PUBLISH_COMPLETE", failReason: null, postIds: ["7123456789012345678"] })
        port.creator.mockResolvedValue({ username: "u", nickname: "n", privacyLevelOptions: ["SELF_ONLY"], commentDisabled: false, duetDisabled: false, stitchDisabled: false, maxVideoPostDurationSec: 300 })

        await expect(service.invoke("ws-1", TIKTOK_TOOL.videoStatusGet, { publishId: "p" }, caller("conn-1"))).resolves.toEqual({
            publishId: "p",
            state: "published",
            providerStatus: "PUBLISH_COMPLETE",
            failReason: null,
            postIds: ["7123456789012345678"],
        })
        await expect(service.invoke("ws-1", TIKTOK_TOOL.creatorInfoGet, {}, caller("conn-1"))).resolves.toMatchObject({ username: "u", privacyLevelOptions: ["SELF_ONLY"] })
    })

    it("refuses not_connected without an account handed, for another workspace's account, or for a provider that reaches no TikTok", async () => {
        await expect(reasonOf((await build()).service.invoke("ws-1", TIKTOK_TOOL.creatorInfoGet, {}, caller()))).resolves.toBe("not_connected")
        await expect(reasonOf((await build(null)).service.invoke("ws-1", TIKTOK_TOOL.creatorInfoGet, {}, caller("conn-1")))).resolves.toBe("not_connected")
        const other = connectionRecord({ ...ACCOUNT, provider: "meta" })
        await expect(reasonOf((await build(other)).service.invoke("ws-1", TIKTOK_TOOL.creatorInfoGet, {}, caller("conn-1")))).resolves.toBe("not_connected")
    })

    it.each([
        ["rejected", "rejected"],
        ["not_found", "not_found"],
        ["auth_refused", "connection_refused"],
        ["no_credential", "not_connected"],
        ["not_available", "not_available"],
    ] as const)("answers a provider's %s as the tool's %s", async (providerReason, toolReason) => {
        const { service, port } = await build()
        port.status.mockRejectedValue(providerRefusal("tiktok", providerReason, "d"))

        await expect(reasonOf(service.invoke("ws-1", TIKTOK_TOOL.videoStatusGet, { publishId: "p" }, caller("conn-1")))).resolves.toBe(toolReason)
    })

    it("throws any other failure as it is", async () => {
        const { service, port } = await build()
        const boom = new Error("network")
        port.status.mockRejectedValue(boom)

        await expect(service.invoke("ws-1", TIKTOK_TOOL.videoStatusGet, { publishId: "p" }, caller("conn-1"))).rejects.toBe(boom)
    })
})
