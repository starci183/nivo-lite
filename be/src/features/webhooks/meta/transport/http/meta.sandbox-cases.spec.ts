import type { RawBodyRequest } from "@nestjs/common"
import type { Request } from "express"
import { mock } from "@starci/jest-preset"
import type { ConnectionsService } from "@modules/domain/connections"
import type { MetaConnectionsService } from "@modules/domain/meta-connections"
import { META_SANDBOX_CATALOGUE, META_SANDBOX_IG_ID, META_SANDBOX_PAGE_ID } from "@modules/domain/meta-connections/meta-sandbox.catalogue"
import { MetaInboxErrorCode, MetaInboxError, type MetaInboxService, type MetaWebhookVerifierService } from "@modules/domain/meta-inbox"
import { FACEBOOK_MESSAGE_WEBHOOK, INSTAGRAM_MESSAGE_WEBHOOK } from "@modules/domain/meta-inbox/meta-message.trigger"
import {
    ProviderSandboxAccountsService,
    SANDBOX_KEY_HEADER,
    SandboxCatalogueRegistryService,
    SandboxWebhookKeyService,
    type SandboxWebhookPost,
} from "@modules/domain/provider-sandbox"
import { parseWebhook } from "@modules/integrations/meta"
import { connectionRecord } from "@tests/fixtures/builders/connection-records.builder"
import { RecordingWebhookPoster, sandboxServiceOf } from "@tests/fixtures/builders/provider-sandbox.builder"
import { MetaWebhook } from "./meta.webhook"

const ACTOR = { principalId: "user-1", workspaceId: "ws-1" }
const SANDBOX = connectionRecord({ id: "11111111-1111-4111-8111-111111111111", workspaceId: "ws-1", provider: "meta", sandbox: true })
const LIVE = connectionRecord({ id: "22222222-2222-4222-8222-222222222222", workspaceId: "ws-1", provider: "meta" })
const OTHER = connectionRecord({ id: "33333333-3333-4333-8333-333333333333", workspaceId: "ws-1", provider: "zalo_oa", sandbox: true })
const KEY = "sbx_key_1"
const NOW = new Date("2026-11-14T02:15:02.000Z")
const ASKED = { psid: "7700110022", text: "Chao shop, cho minh hoi gia bo hoa hong do nhe" }

/**
 * THE ONE SEND of every Meta case (owner ruling R62) through the REAL Meta webhook controller. Meta's own webhook is app-wide and names
 * no connection, so a sandbox account has its own door beside it (`webhook/<connectionId>`): the Sandbox doors build the case's body, the
 * poster hands each call to `MetaWebhook.receiveSandbox` exactly as the HTTP route would (the raw bytes, the route's connection id, the
 * `x-nivo-sandbox-key` header), the real `SandboxWebhookKeyService` over the memory store proves the key, and Meta's real parser reads the
 * delivered bytes. Only the inbox intake behind the controller and the live app-signature verifier are doubles.
 */
const world = () => {
    const connections = mock<ConnectionsService>()
    connections.authorize.mockResolvedValue({ role: "owner", displayName: "Lan" })
    connections.find.mockImplementation((_ws, id) => Promise.resolve([SANDBOX, LIVE, OTHER].find((one) => one.id === id) ?? null))
    connections.sandboxKeyOf.mockImplementation((_ws, id) => Promise.resolve(id === SANDBOX.id || id === OTHER.id ? KEY : null))
    connections.isSandboxKey.mockImplementation((id, presented) => (id === SANDBOX.id || id === OTHER.id) && presented === KEY)
    const { sandbox, store } = sandboxServiceOf(SANDBOX, LIVE, OTHER)
    const guard = new SandboxWebhookKeyService(store, { enabled: true }, connections)
    const inbox = mock<MetaInboxService>()
    inbox.acceptSandbox.mockResolvedValue(undefined)
    inbox.accept.mockResolvedValue(undefined)
    const signature = mock<MetaWebhookVerifierService>()
    signature.verify.mockImplementation(() => {
        throw new MetaInboxError({ code: MetaInboxErrorCode.SignatureInvalid })
    })
    const door = new MetaWebhook(inbox, signature, mock<MetaConnectionsService>(), guard)
    /** What the HTTP route does with one call: the raw bytes, the id the path names, the sandbox header. */
    const route = async (call: SandboxWebhookPost) => {
        const connectionId = call.path.split("/").at(-1) ?? ""
        const rawBody = Buffer.from(JSON.stringify(call.body))
        try {
            await door.receiveSandbox(mock<RawBodyRequest<Request>>({ rawBody }), { connectionId }, call.headers[SANDBOX_KEY_HEADER])
            return { status: 200, body: null }
        } catch (cause) {
            return { status: 401, body: { code: (cause as { code?: string }).code } }
        }
    }
    const poster = new RecordingWebhookPoster(route)
    const catalogues = new SandboxCatalogueRegistryService()
    catalogues.register(META_SANDBOX_CATALOGUE)
    const doors = new ProviderSandboxAccountsService(connections, sandbox, catalogues, poster, { now: () => NOW })
    /** What the controller handed its intake: the bytes, the account, and Meta's real reading of them. */
    const accepted = () =>
        inbox.acceptSandbox.mock.calls.map(([raw, owner]) => ({
            owner,
            events: parseWebhook(JSON.parse(String(raw)), NOW.getTime()),
            body: JSON.parse(String(raw)) as Record<string, unknown>,
        }))
    return { doors, inbox, signature, accepted, route, door }
}

describe("Meta sandbox cases on the real Meta webhook controller (R62)", () => {
    it.each([
        ["META-1", "facebook", META_SANDBOX_PAGE_ID, NOW.getTime(), ASKED],
        ["META-2", "facebook", META_SANDBOX_PAGE_ID, NOW.getTime(), { psid: ASKED.psid }],
        ["META-3", "facebook", META_SANDBOX_PAGE_ID, NOW.getTime() - 25 * 3_600_000, ASKED],
        ["META-4", "instagram", META_SANDBOX_IG_ID, NOW.getTime(), ASKED],
        ["META-5", "instagram", META_SANDBOX_IG_ID, NOW.getTime(), { psid: ASKED.psid }],
        ["META-6", "instagram", META_SANDBOX_IG_ID, NOW.getTime() - 25 * 3_600_000, ASKED],
    ])("%s reaches the intake once as the account's own %s direct message (surface %s) stamped %d, proven by the sandbox key (no app signature asked)", async (caseId, platform, surface, stamp, input) => {
        const { doors, signature, accepted } = world()

        const sent = await doors.send(ACTOR, SANDBOX.id, caseId, input)

        expect(sent.deliveries).toEqual([{ path: `api/connections/meta/webhook/${SANDBOX.id}`, status: 200, body: null }])
        expect(signature.verify).not.toHaveBeenCalled()
        const [one, ...rest] = accepted()
        expect(rest).toEqual([])
        expect(one?.owner).toEqual({ id: SANDBOX.id, workspaceId: "ws-1" })
        expect(one?.body.object).toBe(platform === "facebook" ? "page" : "instagram")
        expect(one?.events).toEqual([
            expect.objectContaining({
                kind: "dm",
                platform,
                mid: "sbx-mid-000001",
                timestamp: stamp,
                ...(platform === "facebook" ? { page_id: surface } : { ig_id: surface }),
            }),
        ])
        const translate = (platform === "facebook" ? FACEBOOK_MESSAGE_WEBHOOK : INSTAGRAM_MESSAGE_WEBHOOK).translate
        const [event] = one?.events ?? []
        const translated = event === undefined ? null : translate({ eventKey: event.event_key, raw: event }, { connectionId: SANDBOX.id })
        if ("text" in input) expect(translated?.data.text).toBe(ASKED.text)
        else expect(translated).toBeNull()
    })

    it("runs the message id on across the account's sends", async () => {
        const { doors, accepted } = world()

        await doors.send(ACTOR, SANDBOX.id, "META-1", ASKED)
        await doors.send(ACTOR, SANDBOX.id, "META-4", ASKED)

        expect(accepted().map((one) => one.events[0]?.mid)).toEqual(["sbx-mid-000001", "sbx-mid-000002"])
    })

    it("refuses the sandbox door without the account's key, for a LIVE account (the app signature is the live route's alone) and for a sandbox account of another provider", async () => {
        const { route, inbox } = world()
        const body = { object: "page", entry: [] }

        await expect(route({ path: `api/connections/meta/webhook/${SANDBOX.id}`, body, headers: { [SANDBOX_KEY_HEADER]: "wrong" } })).resolves.toEqual({
            status: 401,
            body: { code: "PROVIDER_SANDBOX_WEBHOOK_KEY_REFUSED" },
        })
        await expect(route({ path: `api/connections/meta/webhook/${LIVE.id}`, body, headers: { [SANDBOX_KEY_HEADER]: KEY } })).resolves.toEqual({
            status: 401,
            body: { code: MetaInboxErrorCode.SignatureInvalid },
        })
        await expect(route({ path: `api/connections/meta/webhook/${OTHER.id}`, body, headers: { [SANDBOX_KEY_HEADER]: KEY } })).resolves.toEqual({
            status: 401,
            body: { code: MetaInboxErrorCode.SignatureInvalid },
        })
        expect(inbox.acceptSandbox).not.toHaveBeenCalled()
    })

    it("leaves the live app-wide route untouched: it still proves Meta's app signature first and a sandbox key means nothing there", async () => {
        const { door, inbox, signature } = world()

        await expect(door.receive(mock<RawBodyRequest<Request>>({ rawBody: Buffer.from("{}") }), undefined)).rejects.toMatchObject({ code: MetaInboxErrorCode.SignatureInvalid })

        expect(signature.verify).toHaveBeenCalledTimes(1)
        expect(inbox.accept).not.toHaveBeenCalled()
        expect(inbox.acceptSandbox).not.toHaveBeenCalled()
    })
})
