import { Test } from "@nestjs/testing"
import { fakeTransaction, mock, mockEntityManager } from "@starci/jest-preset"
import { isTransactionManager } from "@starci/jest-preset/entity-manager"
import { ProviderTriggersService, type DeliverResult } from "@modules/domain/provider-triggers"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { WebsiteIntakeLogEvent } from "./website-intake.log-events"
import { WEBSITE_FORM_TRIGGER } from "./website-form.trigger"
import { WebsiteLeadWakeService } from "./website-lead-wake.service"
import type { WebsiteSubmissionFacts } from "./website-lead-wake.policy"

const WORKSPACE = "ws-1"
const AGENT = "agent-1"

const FACTS: WebsiteSubmissionFacts = {
    contactId: "contact-1",
    siteId: "site-1",
    inboundEventId: "ev-1",
    visitorKey: "visitor:5f1c",
    name: "Cam",
    phone: "84900000101",
    email: null,
    request: "roses",
    source: { page: "/dat-hoa" },
}

const deliveredOf = (woken: number, repeats = 0): DeliverResult => ({
    status: "delivered",
    events: 1,
    dropped: 0,
    woken: Array.from({ length: woken }, () => ({ agentId: AGENT, workflowId: "wf-1", eventId: "ev-1", wakeId: "wake-1" })),
    repeats,
    untaken: woken === 0 && repeats === 0 ? 1 : 0,
    held: 0,
})

const build = async () => {
    const tx = fakeTransaction(mockEntityManager({}))
    const triggers = mock<ProviderTriggersService>()
    triggers.deliver.mockResolvedValue(deliveredOf(1))
    const logger = mock<Logger>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            WebsiteLeadWakeService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: tx.em },
            { provide: LOGGER, useValue: logger },
            { provide: ProviderTriggersService, useValue: triggers },
        ],
    }).compile()
    return { wakes: moduleRef.get(WebsiteLeadWakeService), triggers, logger }
}

describe("WebsiteLeadWakeService wake", () => {
    it("hands the submission to the ONE delivery for the site's owning agent, as the form's trigger translates it, in one transaction", async () => {
        const { wakes, triggers, logger } = await build()

        await expect(wakes.wake(WORKSPACE, AGENT, FACTS)).resolves.toBe(true)

        expect(isTransactionManager(triggers.deliver.mock.calls[0]?.[1])).toBe(true)
        expect(triggers.deliver.mock.calls[0]?.[0]).toEqual({
            workspaceId: WORKSPACE,
            declaration: WEBSITE_FORM_TRIGGER,
            connectionId: "site-1",
            agentId: AGENT,
            events: [
                {
                    event: {
                        id: "ev-1",
                        subject: { channel: "website", id: "visitor:5f1c", name: "Cam" },
                        data: {
                            siteId: "site-1",
                            inboundEventId: "ev-1",
                            request: "roses",
                            contact: { name: "Cam", phone: "84900000101", email: null },
                            source: { page: "/dat-hoa" },
                        },
                    },
                    contactId: "contact-1",
                },
            ],
        })
        expect(logger.info).toHaveBeenCalledWith(WebsiteIntakeLogEvent.SubmissionWoke, { contactId: "contact-1", agentId: AGENT })
    })

    it("answers false and logs why when the same form was delivered before or no graph of the agent took it", async () => {
        const { wakes, triggers, logger } = await build()
        triggers.deliver.mockResolvedValueOnce(deliveredOf(0, 1)).mockResolvedValueOnce(deliveredOf(0))

        await expect(wakes.wake(WORKSPACE, AGENT, FACTS)).resolves.toBe(false)
        await expect(wakes.wake(WORKSPACE, AGENT, FACTS)).resolves.toBe(false)

        expect(logger.info.mock.calls.map((call) => call[1])).toEqual([
            { contactId: "contact-1", reason: "duplicate" },
            { contactId: "contact-1", reason: "untaken" },
        ])
    })

    it("hands the same event id for a replay of the same form", async () => {
        const { wakes, triggers } = await build()

        await wakes.wake(WORKSPACE, AGENT, FACTS)
        await wakes.wake(WORKSPACE, AGENT, FACTS)

        expect(triggers.deliver.mock.calls.map((call) => call[0].events[0]?.event.id)).toEqual(["ev-1", "ev-1"])
    })
})
