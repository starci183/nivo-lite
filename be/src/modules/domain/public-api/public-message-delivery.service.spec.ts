import { Test } from "@nestjs/testing"
import { FakeClock, mock } from "@starci/jest-preset"
import { ChannelDeliveryService, ChannelsError, ChannelsErrorCode } from "@modules/domain/channels"
import type { ContactIdentity, ContactWithIdentities } from "@modules/domain/contacts"
import { ContactsService } from "@modules/domain/contacts"
import { ChannelDeliveriesService } from "@modules/domain/customer-routes"
import { CLOCK } from "@modules/platform/clock"
import { MemoryChannelDeliveryStore } from "@tests/fixtures/builders/customer-routes-stores.builder"
import type { PendingMessageDelivery } from "./public-api.contracts"
import { PublicMessageDeliveryService } from "./public-message-delivery.service"

const WS = "11111111-1111-4111-8111-111111111111"
const AT = "2026-11-14T03:00:00.000Z"

const PENDING: PendingMessageDelivery = {
    workspaceId: WS,
    sendKey: "api.message:request-1",
    routeId: "route-1",
    contactId: "contact-1",
    agentId: "agent-1",
    channel: "zalo",
    accountId: "conn-1",
    text: "Hello from the API",
}

const identity: ContactIdentity = {
    id: "identity-1",
    contactId: "contact-1",
    kind: "channel",
    provider: "zalo",
    account: "conn-1",
    value: "user-1",
    verified: true,
    verifiedBy: "channel",
    source: "channel",
    joinedBy: null,
    at: AT,
}

const personOf = (identities: ReadonlyArray<ContactIdentity>): ContactWithIdentities => ({
    id: "contact-1",
    workspaceId: WS,
    displayName: null,
    tags: [],
    state: "active",
    createdAt: AT,
    updatedAt: AT,
    identities,
})

const build = async (identities: ReadonlyArray<ContactIdentity> = [identity]) => {
    const store = new MemoryChannelDeliveryStore()
    const people = mock<ContactsService>()
    people.current.mockImplementation((_workspace, id) => Promise.resolve(id))
    people.get.mockResolvedValue(personOf(identities))
    const ledger = new ChannelDeliveriesService(store, people)
    const channels = mock<ChannelDeliveryService>()
    channels.deliverToPerson.mockResolvedValue({ delivered: true, failure: null, outcome: "acknowledged" })
    const moduleRef = await Test.createTestingModule({
        providers: [
            PublicMessageDeliveryService,
            { provide: ChannelDeliveriesService, useValue: ledger },
            { provide: ChannelDeliveryService, useValue: channels },
            { provide: ContactsService, useValue: people },
            { provide: CLOCK, useValue: new FakeClock(AT) },
        ],
    }).compile()
    return { service: moduleRef.get(PublicMessageDeliveryService), ledger, channels }
}

describe("PublicMessageDeliveryService", () => {
    it("claims the send key in the delivery ledger, sends to the person's id on the channel and settles the row delivered", async () => {
        const { service, ledger, channels } = await build()

        await service.send(PENDING)

        expect(channels.deliverToPerson).toHaveBeenCalledWith({
            workspaceId: WS,
            routeId: "route-1",
            channel: "zalo",
            accountId: "conn-1",
            userId: "user-1",
            sendKey: "api.message:request-1",
            text: "Hello from the API",
        })
        expect(await ledger.byKey(WS, "api.message:request-1")).toMatchObject({
            state: "delivered",
            agentId: "agent-1",
            runId: null,
            stepKey: null,
            text: "Hello from the API",
        })
    })

    it("never sends the same request twice: a delivered key answers its earlier outcome", async () => {
        const { service, channels } = await build()

        await service.send(PENDING)
        await service.send(PENDING)

        expect(channels.deliverToPerson).toHaveBeenCalledTimes(1)
    })

    it("keeps an uncertain outcome as unknown and never sends it again; a definite refusal is a refused row a retry may send", async () => {
        const unsure = await build()
        unsure.channels.deliverToPerson.mockResolvedValue({ delivered: false, failure: null, outcome: "ambiguous" })
        await unsure.service.send(PENDING)
        await unsure.service.send(PENDING)
        expect(unsure.channels.deliverToPerson).toHaveBeenCalledTimes(1)
        expect(await unsure.ledger.byKey(WS, PENDING.sendKey)).toMatchObject({ state: "unknown" })

        const refused = await build()
        refused.channels.deliverToPerson.mockResolvedValueOnce({ delivered: false, failure: "zalo_window_expired", outcome: "rejected" })
        await refused.service.send(PENDING)
        expect(await refused.ledger.byKey(WS, PENDING.sendKey)).toMatchObject({ state: "refused", reason: "zalo_window_expired" })
        await refused.service.send(PENDING)
        expect(refused.channels.deliverToPerson).toHaveBeenCalledTimes(2)
        expect(await refused.ledger.byKey(WS, PENDING.sendKey)).toMatchObject({ state: "delivered" })
    })

    it("settles a person with no channel identity on the route's entrance as a refusal, asking no provider", async () => {
        const { service, ledger, channels } = await build([])

        await service.send(PENDING)

        expect(channels.deliverToPerson).not.toHaveBeenCalled()
        expect(await ledger.byKey(WS, PENDING.sendKey)).toMatchObject({ state: "refused", reason: "recipient_not_linked" })
    })

    it("settles the row refused and throws on a busy Zalo token refresh, so the retry of the job sends", async () => {
        const { service, ledger, channels } = await build()
        const busy = new ChannelsError({ code: ChannelsErrorCode.ZaloRefreshBusy })
        channels.deliverToPerson.mockRejectedValueOnce(busy)

        await expect(service.send(PENDING)).rejects.toBe(busy)
        expect(await ledger.byKey(WS, PENDING.sendKey)).toMatchObject({ state: "refused", reason: "channel_busy" })

        await service.send(PENDING)
        expect(await ledger.byKey(WS, PENDING.sendKey)).toMatchObject({ state: "delivered" })
    })
})
