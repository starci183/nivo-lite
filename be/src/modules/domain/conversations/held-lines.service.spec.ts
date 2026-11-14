import { Test } from "@nestjs/testing"
import { FakeClock, fakeTransaction, mock, mockEntityManager } from "@starci/jest-preset"
import { PROVIDER, TRIGGER } from "@nivo-lite/agent-sdk/names"
import { z } from "zod"
import { CustomerRoutesService } from "@modules/domain/customer-routes"
import { ProviderTriggersService, triggerDeclarations, type DeliverInput } from "@modules/domain/provider-triggers"
import type { TriggerDeclaration } from "@modules/domain/provider-triggers/trigger-declaration.contracts"
import { CLOCK } from "@modules/platform/clock"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { LOGGER, type Logger } from "@modules/platform/logging"
import { ConversationsLogEvent } from "./conversations.log-events"
import { HeldLinesService } from "./held-lines.service"

const WS = "11111111-1111-4111-8111-111111111111"
const NOW = Date.parse("2026-10-12T10:00:00.000Z")

/** A Telegram line's declaration as the channel declares it (its data takes the hand-back's: no words, `resume`). */
const LINE_DATA = z.object({
    messageKey: z.string(),
    text: z.string(),
    at: z.string().nullable(),
    attachments: z.array(z.unknown()),
    resume: z.literal("held").optional(),
})
const TELEGRAM_LINE: TriggerDeclaration<unknown, z.infer<typeof LINE_DATA>> = {
    provider: PROVIDER.telegram,
    name: "held-lines-spec.message",
    verb: TRIGGER.telegramMessageReceived,
    via: "webhook",
    raw: z.unknown(),
    data: LINE_DATA,
    translate: () => null,
    key: { by: "subject" },
}
triggerDeclarations.register(TELEGRAM_LINE)

type Route = NonNullable<Awaited<ReturnType<CustomerRoutesService["get"]>>>

const build = async (route: Partial<Route> | null) => {
    const routes = mock<CustomerRoutesService>()
    routes.get.mockResolvedValue(
        route === null
            ? null
            : mock<Route>({ id: "route-1", contactId: "contact-1", channel: "telegram", accountId: "conn-tg", ...route }),
    )
    const triggers = mock<ProviderTriggersService>()
    triggers.deliver.mockResolvedValue({
        status: "delivered",
        events: 1,
        dropped: 0,
        woken: [{ agentId: "agent-front", workflowId: "wf-front", eventId: "resume", wakeId: "wake-front" }],
        repeats: 0,
        untaken: 0,
        held: 0,
    })
    const manager = mockEntityManager()
    fakeTransaction(manager)
    const logger = mock<Logger>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            HeldLinesService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: manager },
            { provide: CLOCK, useValue: new FakeClock(new Date(NOW)) },
            { provide: LOGGER, useValue: logger },
            { provide: CustomerRoutesService, useValue: routes },
            { provide: ProviderTriggersService, useValue: triggers },
        ],
    }).compile()
    return { service: moduleRef.get(HeldLinesService), triggers, logger }
}

describe("HeldLinesService: the hand-back is ONE event of the route's channel verb, through the one delivery function (D7)", () => {
    it("delivers the resume event on the route and its account, keyed by the route, with no words", async () => {
        const { service, triggers } = await build({})

        await expect(service.answerHeld(WS, "route-1")).resolves.toBe(1)

        const [[input]] = triggers.deliver.mock.calls as unknown as [[DeliverInput]]
        expect(input).toEqual({
            workspaceId: WS,
            declaration: TELEGRAM_LINE,
            connectionId: "conn-tg",
            agentId: null,
            events: [
                {
                    event: {
                        id: `resume:route-1:${NOW}`,
                        data: { messageKey: "", text: "", at: null, attachments: [], resume: "held" },
                    },
                    contactId: "contact-1",
                    routeId: "route-1",
                },
            ],
        })
        // The declaration of the channel takes the hand-back's data as one of its own lines.
        expect(TELEGRAM_LINE.data.safeParse(input.events[0]?.event.data).success).toBe(true)
    })

    it("wakes nobody for an id no route holds, or a route of an entrance with no account", async () => {
        const none = await build(null)
        await expect(none.service.answerHeld(WS, "route-x")).resolves.toBe(0)
        const siteless = await build({ accountId: null })
        await expect(siteless.service.answerHeld(WS, "route-1")).resolves.toBe(0)
        expect(none.triggers.deliver).not.toHaveBeenCalled()
        expect(siteless.triggers.deliver).not.toHaveBeenCalled()
        // R37: never silent: one line each (a route not found, its contact erased; a route of no account).
        expect(none.logger.info).toHaveBeenCalledWith(ConversationsLogEvent.ResumeNoRoute, {
            workspaceId: WS,
            routeId: "route-x",
            found: false,
        })
        expect(siteless.logger.info).toHaveBeenCalledWith(ConversationsLogEvent.ResumeNoRoute, {
            workspaceId: WS,
            routeId: "route-1",
            found: true,
        })
    })

    it("wakes nobody when the route's channel has no registered declaration", async () => {
        const { service, triggers } = await build({ channel: "instagram" })

        await expect(service.answerHeld(WS, "route-1")).resolves.toBe(0)
        expect(triggers.deliver).not.toHaveBeenCalled()
    })
})
