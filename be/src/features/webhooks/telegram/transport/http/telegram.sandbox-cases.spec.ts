import type { RawBodyRequest } from "@nestjs/common"
import type { Request } from "express"
import { mock } from "@starci/jest-preset"
import type { ConnectionsService } from "@modules/domain/connections"
import {
    ProviderSandboxAccountsService,
    SANDBOX_KEY_HEADER,
    SandboxCatalogueRegistryService,
    SandboxWebhookKeyService,
    type SandboxWebhookPost,
} from "@modules/domain/provider-sandbox"
import { TELEGRAM_MESSAGE_WEBHOOK, TelegramInboxService } from "@modules/domain/telegram-inbox"
import { telegramSenderOf, telegramUpdateRowsOf } from "@modules/domain/telegram-inbox/telegram.normalise.policy"
import { TELEGRAM_SANDBOX_CATALOGUE, TELEGRAM_SANDBOX_UPDATE_BASE } from "@modules/domain/telegram-inbox/telegram-sandbox.catalogue"
import { ScopedWebhookVerifier } from "@modules/domain/webhook-proofs"
import type { WebhookProofRegistry } from "@modules/platform/http-security"
import { connectionRecord } from "@tests/fixtures/builders/connection-records.builder"
import { RecordingWebhookPoster, sandboxServiceOf } from "@tests/fixtures/builders/provider-sandbox.builder"
import { TelegramWebhook } from "./telegram.webhook"

const ACTOR = { principalId: "user-1", workspaceId: "ws-1" }
const SANDBOX = connectionRecord({ id: "11111111-1111-4111-8111-111111111111", workspaceId: "ws-1", provider: "telegram", sandbox: true })
const LIVE = connectionRecord({ id: "22222222-2222-4222-8222-222222222222", workspaceId: "ws-1", provider: "telegram" })
const KEY = "sbx_key_1"
const NOW = new Date("2026-11-14T02:15:02.000Z")
const ASKED = { chatId: 700100200, text: "Chao shop, cho minh hoi gia bo hoa hong do nhe" }

/**
 * THE ONE SEND of every Telegram case (owner ruling R62) through the REAL Telegram webhook controller: the Sandbox doors build the case's
 * update, the poster hands each call to `TelegramWebhook.receive` exactly as the HTTP route would (the raw body bytes, the route's
 * connection id, the `x-nivo-sandbox-key` header and no bot secret token), the real shared verifier asks the real sandbox key guard, and the
 * real Telegram reading of the delivered bytes (update row, sender, message trigger) is asserted. Only the inbox intake behind the
 * controller and the live secret-token registry are doubles.
 */
const world = () => {
    const connections = mock<ConnectionsService>()
    connections.authorize.mockResolvedValue({ role: "owner", displayName: "Lan" })
    connections.find.mockImplementation((_ws, id) => Promise.resolve([SANDBOX, LIVE].find((one) => one.id === id) ?? null))
    connections.sandboxKeyOf.mockImplementation((_ws, id) => Promise.resolve(id === SANDBOX.id ? KEY : null))
    connections.isSandboxKey.mockImplementation((id, presented) => id === SANDBOX.id && presented === KEY)
    const { sandbox, store } = sandboxServiceOf(SANDBOX, LIVE)
    const guard = new SandboxWebhookKeyService(store, { enabled: true }, connections)
    const proofs = mock<WebhookProofRegistry>()
    proofs.verify.mockResolvedValue(undefined)
    const deliveries = mock<TelegramInboxService>()
    deliveries.acceptTelegramDelivery.mockResolvedValue(undefined)
    const door = new TelegramWebhook(new ScopedWebhookVerifier(proofs, guard), deliveries)
    /** What the HTTP route does with one call: the raw bytes, the id the path names, the sandbox header, no bot secret token. */
    const route = async (call: SandboxWebhookPost) => {
        const connectionId = call.path.split("/").at(-1) ?? ""
        const rawBody = Buffer.from(JSON.stringify(call.body))
        try {
            await door.receive(mock<RawBodyRequest<Request>>({ rawBody }), { connectionId }, undefined, call.headers[SANDBOX_KEY_HEADER])
            return { status: 200, body: null }
        } catch (cause) {
            return { status: 401, body: { code: (cause as { code?: string }).code } }
        }
    }
    const poster = new RecordingWebhookPoster(route)
    const catalogues = new SandboxCatalogueRegistryService()
    catalogues.register(TELEGRAM_SANDBOX_CATALOGUE)
    const doors = new ProviderSandboxAccountsService(connections, sandbox, catalogues, poster, { now: () => NOW })
    /** What the controller handed its intake: the bytes, the connection, and the real Telegram reading of them. */
    const accepted = () =>
        deliveries.acceptTelegramDelivery.mock.calls.map(([raw, connection]) => ({
            connection,
            rows: telegramUpdateRowsOf(raw as Buffer),
            body: JSON.parse(String(raw)) as Record<string, unknown>,
        }))
    return { doors, proofs, deliveries, accepted, route }
}

describe("Telegram sandbox cases on the real Telegram webhook controller (R62)", () => {
    it.each([
        ["TELEGRAM-1", "text", ASKED],
        ["TELEGRAM-2", "photo", { chatId: ASKED.chatId }],
    ])("%s reaches the intake once as a %s message update, proven by the sandbox key (no bot secret token asked)", async (caseId, kind, input) => {
        const { doors, proofs, accepted } = world()

        const sent = await doors.send(ACTOR, SANDBOX.id, caseId, input)

        expect(sent.deliveries).toEqual([{ path: `api/telegram/${SANDBOX.id}`, status: 200, body: null }])
        expect(proofs.verify).not.toHaveBeenCalled()
        const [one, ...rest] = accepted()
        expect(rest).toEqual([])
        expect(one?.connection).toBe(SANDBOX.id)
        expect(one?.rows).toEqual([
            { type: expect.any(String), value: { updateId: String(TELEGRAM_SANDBOX_UPDATE_BASE + 1), raw: one?.body } },
        ])
        expect(telegramSenderOf(one?.body)).toMatchObject({ userId: String(ASKED.chatId) })
        const read = TELEGRAM_MESSAGE_WEBHOOK.raw.safeParse(one?.rows[0]?.value)
        expect(read.success).toBe(true)
        const event = read.success ? TELEGRAM_MESSAGE_WEBHOOK.translate(read.data, { connectionId: SANDBOX.id }) : null
        expect(event).not.toBeNull()
        if (kind === "text") expect(event?.data.text).toBe(ASKED.text)
        else expect(event?.data.attachments).toHaveLength(1)
    })

    it("runs the update id on across the account's sends", async () => {
        const { doors, accepted } = world()

        await doors.send(ACTOR, SANDBOX.id, "TELEGRAM-1", ASKED)
        await doors.send(ACTOR, SANDBOX.id, "TELEGRAM-2", { chatId: ASKED.chatId })

        expect(accepted().map((one) => one.body.update_id)).toEqual([TELEGRAM_SANDBOX_UPDATE_BASE + 1, TELEGRAM_SANDBOX_UPDATE_BASE + 2])
    })

    it("refuses a call for the sandbox account without its key, and a LIVE account still runs the Telegram secret-token proof", async () => {
        const { route, deliveries, proofs } = world()

        await expect(route({ path: `api/telegram/${SANDBOX.id}`, body: { update_id: 1 }, headers: { [SANDBOX_KEY_HEADER]: "wrong" } })).resolves.toEqual({
            status: 401,
            body: { code: "PROVIDER_SANDBOX_WEBHOOK_KEY_REFUSED" },
        })
        expect(deliveries.acceptTelegramDelivery).not.toHaveBeenCalled()

        await route({ path: `api/telegram/${LIVE.id}`, body: { update_id: 1 }, headers: { [SANDBOX_KEY_HEADER]: KEY } })
        expect(proofs.verify).toHaveBeenCalledTimes(1)
        expect(proofs.verify).toHaveBeenCalledWith("telegram", expect.objectContaining({ scope: LIVE.id }))
    })
})
