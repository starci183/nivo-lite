import { readFileSync } from "node:fs"
import type { InstagramMediaRequest } from "@modules/domain/provider-registry"
import { proofOf, providerRefusalDetail, providerRefusalReason } from "@modules/domain/provider-registry"
import { ProviderSandboxError, ProviderSandboxErrorCode } from "@modules/domain/provider-sandbox"
import { connectionRecord } from "@tests/fixtures/builders/connection-records.builder"
import { sandboxAccount, sandboxServiceOf, sandboxServiceOff } from "@tests/fixtures/builders/provider-sandbox.builder"
import { MetaInstagramSandboxPublishService } from "./meta-instagram-sandbox-publish.service"
import { INSTAGRAM_SANDBOX_CATALOGUE, INSTAGRAM_SANDBOX_MEDIA } from "./meta-instagram-sandbox.catalogue"

const build = () => {
    const account = sandboxAccount({ provider: "meta" })
    const { sandbox } = sandboxServiceOf(account)
    const connection = connectionRecord({ provider: "meta", id: account.id, workspaceId: account.workspaceId, sandbox: true })
    return { account, sandbox, connection, instagram: new MetaInstagramSandboxPublishService(sandbox) }
}

const failure = (work: Promise<unknown>): Promise<unknown> => Promise.resolve(work.then(() => undefined, (cause: unknown) => cause))
const image = (caption: string | null, overrides: Partial<InstagramMediaRequest> = {}): InstagramMediaRequest => ({
    mediaType: "image",
    caption,
    mediaUrl: "https://shop.test/a.jpg",
    children: [],
    altText: null,
    aiGenerated: null,
    ...overrides,
})

describe("MetaInstagramSandboxPublishService", () => {
    it("publishes a finished container at once for a caption the catalogue does not name (INSTAGRAM-1)", async () => {
        const { instagram, connection } = build()

        await expect(instagram.publish(connection, image("Bộ sưu tập thu"))).resolves.toEqual({
            containerId: "sbx-ig-container-000001",
            state: "published",
            statusCode: "PUBLISHED",
            mediaId: "sbx-ig-media-000001",
        })
        await expect(instagram.status(connection, "sbx-ig-container-000001")).resolves.toEqual({
            containerId: "sbx-ig-container-000001",
            state: "published",
            statusCode: "PUBLISHED",
            mediaId: null,
        })
    })

    it("answers a processing container, then finished by the status poll, then published by release (INSTAGRAM-2)", async () => {
        const { instagram, connection } = build()
        const reel = image("Reel hậu trường buổi chụp", { mediaType: "reels" })

        await expect(instagram.publish(connection, reel)).resolves.toMatchObject({ state: "pending", statusCode: "IN_PROGRESS", mediaId: null })
        await expect(instagram.status(connection, "sbx-ig-container-000001")).resolves.toMatchObject({ state: "ready", statusCode: "FINISHED" })
        await expect(instagram.release(connection, "sbx-ig-container-000001")).resolves.toEqual({
            containerId: "sbx-ig-container-000001",
            state: "published",
            statusCode: "PUBLISHED",
            mediaId: "sbx-ig-media-000001",
        })
    })

    it("ends a container in ERROR, never publishable, on the later status read (INSTAGRAM-3) and stays there", async () => {
        const { instagram, connection } = build()

        await expect(instagram.publish(connection, image("Reel lỗi mã hóa", { mediaType: "reels" }))).resolves.toMatchObject({ state: "pending" })
        await expect(instagram.status(connection, "sbx-ig-container-000001")).resolves.toMatchObject({ state: "failed", statusCode: "ERROR" })
        await expect(instagram.release(connection, "sbx-ig-container-000001")).resolves.toMatchObject({ state: "failed", mediaId: null })
    })

    it.each([
        ["Caption vi phạm chính sách", "rejected", "policy: media violates community guidelines"],
        ["Video quá dài", "rejected", "video duration over the limit"],
        ["Bài đăng khi token hết hạn", "auth_refused", "Error validating access token: session expired"],
    ] as const)("refuses the named caption %s as the live twin refuses it (%s, not_sent) and creates nothing", async (caption, reason, detail) => {
        const { instagram, connection, sandbox, account } = build()

        const error = await failure(instagram.publish(connection, image(caption)))

        expect(providerRefusalReason(error)).toBe(reason)
        expect(providerRefusalDetail(error)).toBe(detail)
        expect(proofOf(error)).toBe("not_sent")
        expect((await sandbox.calls(account, "publish"))[0]?.result.outcome).toBe("threw")
        expect(providerRefusalReason(await failure(instagram.status(connection, "sbx-ig-container-000001")))).toBe("not_found")
    })

    it("refuses a request that does not fit its kind before anything is created, as the live twin does", async () => {
        const { instagram, connection } = build()

        expect(providerRefusalDetail(await failure(instagram.publish(connection, image("x", { mediaUrl: null }))))).toBe("media url")
        expect(providerRefusalDetail(await failure(instagram.publish(connection, image("x", { mediaType: "carousel", mediaUrl: null }))))).toBe("carousel items")
        const items = Array.from({ length: 21 }, () => ({ kind: "image" as const, url: "https://shop.test/a.jpg" }))
        expect(providerRefusalDetail(await failure(instagram.publish(connection, image("x", { mediaType: "carousel", mediaUrl: null, children: items }))))).toBe("carousel items")
        await expect(instagram.publish(connection, image("x", { mediaType: "carousel", mediaUrl: null, children: items.slice(0, 2) }))).resolves.toMatchObject({ state: "published" })
    })

    it("answers not_found (not_sent) for a container the account never created (INSTAGRAM-7)", async () => {
        const { instagram, connection } = build()

        for (const call of [instagram.status(connection, "nope"), instagram.release(connection, "nope")]) {
            const error = await failure(call)
            expect(providerRefusalReason(error)).toBe("not_found")
            expect(proofOf(error)).toBe("not_sent")
        }
    })

    it("takes one logged call per request, keyed by caption or container id", async () => {
        const { instagram, connection, sandbox, account } = build()

        await instagram.publish(connection, image("Reel hậu trường buổi chụp", { mediaType: "reels" }))
        await instagram.status(connection, "sbx-ig-container-000001")
        await instagram.release(connection, "sbx-ig-container-000001")

        expect((await sandbox.calls(account)).map((call) => [call.operation, call.key])).toEqual([
            ["publish", "Reel hậu trường buổi chụp"],
            ["status", "sbx-ig-container-000001"],
            ["release", "sbx-ig-container-000001"],
        ])
    })

    it("is deterministic: two fresh accounts walk the same ids and words", async () => {
        const one = build()
        const two = build()
        const reel = image("Reel hậu trường buổi chụp", { mediaType: "reels" })

        expect(await one.instagram.publish(one.connection, reel)).toEqual(await two.instagram.publish(two.connection, reel))
        expect(await one.instagram.status(one.connection, "sbx-ig-container-000001")).toEqual(await two.instagram.status(two.connection, "sbx-ig-container-000001"))
    })

    it("refuses a live account and a switched-off sandbox", async () => {
        const { instagram } = build()
        const live = await failure(instagram.status(connectionRecord({ provider: "meta", id: "live-1" }), "x"))
        expect(live).toBeInstanceOf(ProviderSandboxError)
        expect((live as ProviderSandboxError).code).toBe(ProviderSandboxErrorCode.LiveAccount)

        const account = sandboxAccount({ provider: "meta" })
        const off = new MetaInstagramSandboxPublishService(sandboxServiceOff(account).sandbox)
        const refused = await failure(off.status(connectionRecord({ provider: "meta", id: account.id, sandbox: true }), "x"))
        expect((refused as ProviderSandboxError).code).toBe(ProviderSandboxErrorCode.Off)
    })

    it("has a catalogue of unique INSTAGRAM-<n> ids, each named caption wired to its case, and no inbound case (a container is polled)", () => {
        const ids = INSTAGRAM_SANDBOX_CATALOGUE.cases.map((one) => one.id)
        expect(new Set(ids).size).toBe(ids.length)
        expect(ids.every((id) => /^INSTAGRAM-\d+$/.test(id))).toBe(true)
        expect(Object.values(INSTAGRAM_SANDBOX_MEDIA).every((one) => ids.includes(one.caseId))).toBe(true)
        expect(INSTAGRAM_SANDBOX_CATALOGUE.cases.every((one) => one.inbound === undefined)).toBe(true)
    })

    it("reaches no host: one constructor parameter and no integration or network word in its source", () => {
        expect(MetaInstagramSandboxPublishService.length).toBe(1)
        const source = readFileSync(__filename.replace(".spec.ts", ".ts"), "utf8")
        expect(source).not.toContain("@modules/integrations")
        expect(source).not.toContain("http")
    })
})
