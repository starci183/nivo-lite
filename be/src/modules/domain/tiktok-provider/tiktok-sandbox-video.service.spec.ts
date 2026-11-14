import { readFileSync } from "node:fs"
import type { TiktokPublishRequest } from "@modules/domain/provider-registry"
import { proofOf, providerRefusalDetail, providerRefusalReason } from "@modules/domain/provider-registry"
import { ProviderSandboxError, ProviderSandboxErrorCode } from "@modules/domain/provider-sandbox"
import { connectionRecord } from "@tests/fixtures/builders/connection-records.builder"
import { sandboxAccount, sandboxServiceOf, sandboxServiceOff } from "@tests/fixtures/builders/provider-sandbox.builder"
import { TIKTOK_SANDBOX_CATALOGUE, TIKTOK_SANDBOX_CREATOR, TIKTOK_SANDBOX_REFUSED_TITLES } from "./tiktok-sandbox.catalogue"
import { TiktokSandboxVideoService } from "./tiktok-sandbox-video.service"

const build = () => {
    const account = sandboxAccount({ provider: "tiktok" })
    const { sandbox } = sandboxServiceOf(account)
    const connection = connectionRecord({ provider: "tiktok", id: account.id, workspaceId: account.workspaceId, sandbox: true })
    return { account, sandbox, connection, tiktok: new TiktokSandboxVideoService(sandbox) }
}

const failure = (work: Promise<unknown>): Promise<unknown> => Promise.resolve(work.then(() => undefined, (cause: unknown) => cause))
const post = (title: string | null, overrides: Partial<TiktokPublishRequest> = {}): TiktokPublishRequest => ({
    source: { kind: "url", videoUrl: "https://shop.test/a.mp4" },
    privacyLevel: "PUBLIC_TO_EVERYONE",
    title,
    disableDuet: null,
    disableStitch: null,
    disableComment: null,
    coverTimestampMs: null,
    brandContentToggle: null,
    brandOrganicToggle: null,
    isAigc: null,
    ...overrides,
})

describe("TiktokSandboxVideoService", () => {
    it("answers the fixed creator (TIKTOK-1)", async () => {
        const { tiktok, connection } = build()

        await expect(tiktok.creator(connection)).resolves.toEqual(TIKTOK_SANDBOX_CREATOR)
    })

    it("accepts a post, then its status walks downloading, then published with the public post id (TIKTOK-2)", async () => {
        const { tiktok, connection } = build()

        await expect(tiktok.publish(connection, post("Clip bán hàng"))).resolves.toEqual({ publishId: "sbx-tt-publish-000001" })
        await expect(tiktok.status(connection, "sbx-tt-publish-000001")).resolves.toEqual({
            publishId: "sbx-tt-publish-000001",
            state: "pending",
            providerStatus: "PROCESSING_DOWNLOAD",
            failReason: null,
            postIds: [],
        })
        await expect(tiktok.status(connection, "sbx-tt-publish-000001")).resolves.toEqual({
            publishId: "sbx-tt-publish-000001",
            state: "published",
            providerStatus: "PUBLISH_COMPLETE",
            failReason: null,
            postIds: ["7300000000000001"],
        })
        await expect(tiktok.status(connection, "sbx-tt-publish-000001")).resolves.toMatchObject({ state: "published" })
    })

    it("accepts a post whose later status is FAILED with TikTok's reason (TIKTOK-6)", async () => {
        const { tiktok, connection } = build()

        await tiktok.publish(connection, post("Clip lỗi xử lý"))

        await expect(tiktok.status(connection, "sbx-tt-publish-000001")).resolves.toMatchObject({ state: "pending", providerStatus: "PROCESSING_UPLOAD" })
        await expect(tiktok.status(connection, "sbx-tt-publish-000001")).resolves.toEqual({
            publishId: "sbx-tt-publish-000001",
            state: "failed",
            providerStatus: "FAILED",
            failReason: "file_format_check_failed",
            postIds: [],
        })
    })

    it("refuses a privacy level the creator does not list, rejected and not_sent (TIKTOK-3)", async () => {
        const { tiktok, connection } = build()

        const error = await failure(tiktok.publish(connection, post("Clip", { privacyLevel: "FOLLOWER_OF_CREATOR" })))

        expect(providerRefusalReason(error)).toBe("rejected")
        expect(providerRefusalDetail(error)).toBe("privacy_level_option_mismatch")
        expect(proofOf(error)).toBe("not_sent")
    })

    it.each([
        ["Clip quá dài", "rejected", "video_duration_too_long"],
        ["Token TikTok hết hạn", "auth_refused", "access_token_invalid"],
    ] as const)("refuses the named title %s as the live twin refuses it (%s, not_sent) and starts nothing", async (title, reason, detail) => {
        const { tiktok, connection, sandbox, account } = build()

        const error = await failure(tiktok.publish(connection, post(title)))

        expect(providerRefusalReason(error)).toBe(reason)
        expect(providerRefusalDetail(error)).toBe(detail)
        expect(proofOf(error)).toBe("not_sent")
        expect((await sandbox.calls(account, "publish"))[0]?.result.outcome).toBe("threw")
        expect(providerRefusalReason(await failure(tiktok.status(connection, "sbx-tt-publish-000001")))).toBe("not_found")
    })

    it("answers not_found (not_sent) for a publish id the account never started (TIKTOK-7)", async () => {
        const { tiktok, connection } = build()

        const error = await failure(tiktok.status(connection, "nope"))

        expect(providerRefusalReason(error)).toBe("not_found")
        expect(proofOf(error)).toBe("not_sent")
    })

    it("takes one logged call per request and numbers the publish ids by the calls before (a refused one takes a number, no dedupe)", async () => {
        const { tiktok, connection, sandbox, account } = build()

        await tiktok.creator(connection)
        await tiktok.publish(connection, post("A"))
        await failure(tiktok.publish(connection, post("Clip quá dài")))
        await expect(tiktok.publish(connection, post("A"))).resolves.toEqual({ publishId: "sbx-tt-publish-000003" })
        await tiktok.status(connection, "sbx-tt-publish-000001")

        expect((await sandbox.calls(account)).map((call) => call.operation)).toEqual(["creator", "publish", "publish", "publish", "status"])
    })

    it("is deterministic: two fresh accounts answer the same", async () => {
        const one = build()
        const two = build()

        expect(await one.tiktok.publish(one.connection, post("A"))).toEqual(await two.tiktok.publish(two.connection, post("A")))
        expect(await one.tiktok.status(one.connection, "sbx-tt-publish-000001")).toEqual(await two.tiktok.status(two.connection, "sbx-tt-publish-000001"))
    })

    it("refuses a live account and a switched-off sandbox", async () => {
        const { tiktok } = build()
        const live = await failure(tiktok.creator(connectionRecord({ provider: "tiktok", id: "live-1" })))
        expect(live).toBeInstanceOf(ProviderSandboxError)
        expect((live as ProviderSandboxError).code).toBe(ProviderSandboxErrorCode.LiveAccount)

        const account = sandboxAccount({ provider: "tiktok" })
        const off = new TiktokSandboxVideoService(sandboxServiceOff(account).sandbox)
        const refused = await failure(off.creator(connectionRecord({ provider: "tiktok", id: account.id, sandbox: true })))
        expect((refused as ProviderSandboxError).code).toBe(ProviderSandboxErrorCode.Off)
    })

    it("has a catalogue of unique TIKTOK-<n> ids with every named title wired to its case, and no inbound case (a post is polled)", () => {
        const ids = TIKTOK_SANDBOX_CATALOGUE.cases.map((one) => one.id)
        expect(new Set(ids).size).toBe(ids.length)
        expect(ids.every((id) => /^TIKTOK-\d+$/.test(id))).toBe(true)
        expect(Object.values(TIKTOK_SANDBOX_REFUSED_TITLES).every((one) => ids.includes(one.caseId))).toBe(true)
        expect(TIKTOK_SANDBOX_CATALOGUE.cases.every((one) => one.inbound === undefined)).toBe(true)
    })

    it("reaches no host: one constructor parameter and no integration or network word in its source", () => {
        expect(TiktokSandboxVideoService.length).toBe(1)
        const source = readFileSync(__filename.replace(".spec.ts", ".ts"), "utf8")
        expect(source).not.toContain("@modules/integrations")
        expect(source).not.toContain("http")
    })
})
