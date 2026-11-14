import { Test } from "@nestjs/testing"
import { fakeTransaction, mock, mockEntityManager } from "@starci/jest-preset"
import { AccountDataIntakeService } from "@modules/domain/account-data"
import { ConnectionBindingsReadService, ConnectionsService } from "@modules/domain/connections"
import { ProviderTriggersService } from "@modules/domain/provider-triggers"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { LOGGER, type Logger } from "@modules/platform/logging"
import { isRecord } from "@modules/platform/primitives"
import {
    FAKE_COMPOSE,
    FAKE_OUTPUT,
    FAKE_SIGNED,
    FakeComposePort,
    composeAccountOf,
} from "@tests/fixtures/builders/video-compose.builder"
import type { RenderDoorDelivery } from "./video-compose.contracts"
import { VideoComposeRegistryService } from "./video-compose-registry.service"
import { VideoRenderIntakeService } from "./video-render-intake.service"
import { renderTriggerOf } from "./video-render.trigger"

const ACCOUNT = composeAccountOf()
const OWNER = { id: ACCOUNT.id, workspaceId: "ws-1", provider: FAKE_COMPOSE }
const body = (hook: Readonly<Record<string, unknown>>): Buffer => Buffer.from(JSON.stringify(hook))
const DONE = body({ id: "r-1", state: "succeeded", url: FAKE_OUTPUT })

/** A delivery the door proved by its token, to the fake provider, with no headers unless given. */
const delivery = (
    rawBody: Buffer | undefined,
    headers: RenderDoorDelivery["headers"] = {},
    provider: string = FAKE_COMPOSE,
): RenderDoorDelivery => ({ provider, connectionId: ACCOUNT.id, rawBody, headers })

/** An intake whose store keeps the render ids it inserted: an `append` row is new once. */
const build = async (
    options: { readonly account?: typeof OWNER | null; readonly fireFails?: boolean; readonly port?: FakeComposePort } = {},
) => {
    const manager = mockEntityManager()
    fakeTransaction(manager)
    const bindings = mock<ConnectionBindingsReadService>()
    bindings.accountOf.mockResolvedValue(options.account === undefined ? OWNER : options.account)
    const kept = new Set<string>()
    const intake = mock<AccountDataIntakeService>()
    intake.claim.mockImplementation((_tx, delivery) => {
        const key = String(isRecord(delivery.value) ? delivery.value["renderId"] : undefined)
        if (kept.has(key)) return Promise.resolve(undefined)
        kept.add(key)
        return Promise.resolve({ type: delivery.type, key, id: `row-${key}`, isNew: true })
    })
    intake.lockPending.mockImplementation((_tx, type, connectionId, key) =>
        Promise.resolve({ id: `row-${key}`, type, key, owner: { ...OWNER, connectionId }, value: {} }),
    )
    const triggers = mock<ProviderTriggersService>()
    if (options.fireFails === true) triggers.deliver.mockRejectedValue(new Error("down"))
    else triggers.deliver.mockResolvedValue({ status: "delivered", events: 1, dropped: 0, woken: [], repeats: 0, untaken: 0, held: 0 })
    const connections = mock<ConnectionsService>()
    connections.readSecret.mockResolvedValue({ plain: "cred", webhookSecret: "hook" })
    const moduleRef = await Test.createTestingModule({
        providers: [
            VideoRenderIntakeService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: manager },
            { provide: LOGGER, useValue: mock<Logger>() },
            VideoComposeRegistryService,
            { provide: ConnectionBindingsReadService, useValue: bindings },
            { provide: ConnectionsService, useValue: connections },
            { provide: AccountDataIntakeService, useValue: intake },
            { provide: ProviderTriggersService, useValue: triggers },
        ],
    }).compile()
    moduleRef.get(VideoComposeRegistryService).register(options.port ?? new FakeComposePort())
    const service = moduleRef.get(VideoRenderIntakeService)
    return { service, intake, triggers }
}

describe("the render door's intake", () => {
    it("keeps a finished render once, hands its row's completion to the ONE delivery as the provider's render trigger translates it, and completes the row", async () => {
        const { service, intake, triggers } = await build()
        await expect(service.accept(delivery(DONE))).resolves.toBe("kept")
        expect(intake.claim.mock.calls[0]?.[1]).toEqual({
            connectionId: ACCOUNT.id,
            type: `${FAKE_COMPOSE}.render`,
            value: { renderId: "r-1", status: "done", outputUrl: FAKE_OUTPUT, provider: FAKE_COMPOSE },
        })
        expect(triggers.deliver.mock.calls[0]?.[0]).toEqual({
            workspaceId: "ws-1",
            declaration: renderTriggerOf(FAKE_COMPOSE),
            connectionId: ACCOUNT.id,
            agentId: null,
            events: [
                {
                    event: { id: "r-1", data: { renderId: "r-1", status: "done", outputUrl: FAKE_OUTPUT, provider: FAKE_COMPOSE } },
                    raw: { type: `${FAKE_COMPOSE}.render`, id: "row-r-1" },
                },
            ],
        })
        expect(intake.complete).toHaveBeenCalledTimes(1)
    })

    it("finishes each render once: the same completion again, or a later one of the same render, writes and fires nothing", async () => {
        const { service, triggers } = await build()
        await service.accept(delivery(DONE))
        await expect(service.accept(delivery(DONE))).resolves.toBe("repeat")
        await expect(service.accept(delivery(body({ id: "r-1", state: "failed" })))).resolves.toBe("repeat")
        expect(triggers.deliver).toHaveBeenCalledTimes(1)
    })

    it.each([
        ["a progress ping", body({ id: "r-1", state: "rendering" }), "ignored"],
        ["a body that is no JSON", Buffer.from("<xml/>"), "unreadable"],
        ["no body at all", undefined, "unreadable"],
        ["a done render with no https output", body({ id: "r-1", state: "succeeded", url: "ftp://x/r.mp4" }), "unreadable"],
    ] as const)("keeps nothing for %s (%s)", async (_name, raw, outcome) => {
        const { service, intake, triggers } = await build()
        await expect(service.accept(delivery(raw))).resolves.toBe(outcome)
        expect(intake.claim).not.toHaveBeenCalled()
        expect(triggers.deliver).not.toHaveBeenCalled()
    })

    it("keeps nothing for an account of another provider, or a provider that composes nothing", async () => {
        const other = await build({ account: { ...OWNER, provider: "veo" } })
        await expect(other.service.accept(delivery(DONE))).resolves.toBe("unknown_account")
        await expect(other.service.accept(delivery(DONE, {}, "veo"))).resolves.toBe("unknown_provider")
        expect(other.intake.claim).not.toHaveBeenCalled()
    })

    it("a delivery that throws leaves the row pending (the wait falls back on its timeout) and still acknowledges", async () => {
        const { service, intake } = await build({ fireFails: true })
        await expect(service.accept(delivery(DONE))).resolves.toBe("kept")
        expect(intake.complete).not.toHaveBeenCalled()
    })

    it("holds a signing provider to its signature header (the port's proves), after the door proved the token", async () => {
        const { service, intake } = await build({ port: new FakeComposePort(FAKE_COMPOSE, FAKE_SIGNED) })
        await expect(service.accept(delivery(DONE, { "x-fake-signature": "nope" }))).resolves.toBe("unsigned")
        await expect(service.accept(delivery(DONE))).resolves.toBe("unsigned")
        expect(intake.claim).not.toHaveBeenCalled()
        await expect(service.accept(delivery(DONE, { "x-fake-signature": ["cred"] }))).resolves.toBe("kept")
    })
})
