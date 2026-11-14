import { readFileSync } from "node:fs"
import { proofOf, providerRefusalDetail, providerRefusalReason } from "@modules/domain/provider-registry"
import { ProviderSandboxError, ProviderSandboxErrorCode } from "@modules/domain/provider-sandbox"
import { connectionRecord } from "@tests/fixtures/builders/connection-records.builder"
import { sandboxAccount, sandboxServiceOf, sandboxServiceOff } from "@tests/fixtures/builders/provider-sandbox.builder"
import { MetaFacebookSandboxPublishService } from "./meta-facebook-sandbox-publish.service"
import { FACEBOOK_SANDBOX_CATALOGUE, FACEBOOK_SANDBOX_POSTS } from "./meta-facebook-sandbox.catalogue"

const build = () => {
    const account = sandboxAccount({ provider: "meta" })
    const { sandbox } = sandboxServiceOf(account)
    const connection = connectionRecord({ provider: "meta", id: account.id, workspaceId: account.workspaceId, sandbox: true })
    return { account, sandbox, connection, facebook: new MetaFacebookSandboxPublishService(sandbox) }
}

const failure = (work: Promise<unknown>): Promise<unknown> => Promise.resolve(work.then(() => undefined, (cause: unknown) => cause))
const text = (message: string | null, link: string | null = null) => ({ message, link, media: null })

describe("MetaFacebookSandboxPublishService", () => {
    it("accepts a text post, a link post, a photo and a video the way the live Page edges answer", async () => {
        const { facebook, connection } = build()

        await expect(facebook.publish(connection, text("Ra mắt sản phẩm mới"))).resolves.toEqual({ kind: "text", postId: "100000000000001_000001", mediaId: null })
        await expect(facebook.publish(connection, text(null, "https://shop.test/a"))).resolves.toMatchObject({ kind: "link", postId: "100000000000001_000002" })
        await expect(
            facebook.publish(connection, { message: "Ảnh", link: null, media: { kind: "photo", url: "https://shop.test/a.jpg", title: null } }),
        ).resolves.toEqual({ kind: "photo", postId: "100000000000001_000003", mediaId: "sbx-photo-000003" })
        await expect(
            facebook.publish(connection, { message: "Clip", link: null, media: { kind: "video", url: "https://shop.test/a.mp4", title: "T" } }),
        ).resolves.toEqual({ kind: "video", postId: null, mediaId: "sbx-video-000004" })
    })

    it.each([
        ["Mua ngay giá sốc, số lượng có hạn", "rejected", "policy: spam content"],
        ["Video quay toàn bộ buổi lễ", "rejected", "video file too large"],
        ["Bài đăng khi token hết hạn", "auth_refused", "Error validating access token: session expired"],
    ] as const)("refuses the named message %s as the live twin refuses it (%s, not_sent)", async (message, reason, detail) => {
        const { facebook, connection, sandbox, account } = build()

        const error = await failure(facebook.publish(connection, text(message)))

        expect(providerRefusalReason(error)).toBe(reason)
        expect(providerRefusalDetail(error)).toBe(detail)
        expect(proofOf(error)).toBe("not_sent")
        expect((await sandbox.calls(account, "publish"))[0]?.result).toMatchObject({ outcome: "threw" })
    })

    it("refuses an empty post rejected before anything is sent, as the live twin does", async () => {
        const { facebook, connection } = build()

        const error = await failure(facebook.publish(connection, { message: null, link: null, media: null }))

        expect(providerRefusalReason(error)).toBe("rejected")
        expect(providerRefusalDetail(error)).toBe("message, link or media")
        expect(proofOf(error)).toBe("not_sent")
    })

    it("logs exactly one call per request with its key and request, and does it again on a second call (no idempotency)", async () => {
        const { facebook, connection, sandbox, account } = build()
        const request = text("Hello")

        const first = await facebook.publish(connection, request)
        const second = await facebook.publish(connection, request)

        expect(first).not.toEqual(second)
        const calls = await sandbox.calls(account, "publish")
        expect(calls).toHaveLength(2)
        expect(calls[0]).toMatchObject({ key: "Hello", request, result: { outcome: "answered", value: first } })
    })

    it("is deterministic: two fresh accounts answer the same", async () => {
        const one = build()
        const two = build()

        await expect(one.facebook.publish(one.connection, text("Hi"))).resolves.toEqual(await two.facebook.publish(two.connection, text("Hi")))
    })

    it("refuses a live account and a switched-off sandbox", async () => {
        const { facebook } = build()
        const live = await failure(facebook.publish(connectionRecord({ provider: "meta", id: "live-1" }), text("Hi")))
        expect(live).toBeInstanceOf(ProviderSandboxError)
        expect((live as ProviderSandboxError).code).toBe(ProviderSandboxErrorCode.LiveAccount)

        const account = sandboxAccount({ provider: "meta" })
        const off = new MetaFacebookSandboxPublishService(sandboxServiceOff(account).sandbox)
        const refused = await failure(off.publish(connectionRecord({ provider: "meta", id: account.id, sandbox: true }), text("Hi")))
        expect((refused as ProviderSandboxError).code).toBe(ProviderSandboxErrorCode.Off)
    })

    it("has a catalogue of unique FACEBOOK-<n> ids, each named case wired to the behaviour, and no inbound case (a post is synchronous)", () => {
        const ids = FACEBOOK_SANDBOX_CATALOGUE.cases.map((one) => one.id)
        expect(new Set(ids).size).toBe(ids.length)
        expect(ids.every((id) => /^FACEBOOK-\d+$/.test(id))).toBe(true)
        expect(FACEBOOK_SANDBOX_CATALOGUE.provider).toBe("meta")
        expect(Object.values(FACEBOOK_SANDBOX_POSTS).every((post) => ids.includes(post.caseId))).toBe(true)
        expect(FACEBOOK_SANDBOX_CATALOGUE.cases.every((one) => one.inbound === undefined && one.operation === "publish")).toBe(true)
    })

    it("reaches no host: one constructor parameter and no integration or network word in its source", () => {
        expect(MetaFacebookSandboxPublishService.length).toBe(1)
        const source = readFileSync(__filename.replace(".spec.ts", ".ts"), "utf8")
        expect(source).not.toContain("@modules/integrations")
        expect(source).not.toContain("http")
    })
})
