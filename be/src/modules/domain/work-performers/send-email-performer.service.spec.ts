import { builder, mock } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import type { Proposal, WorkContext, WorkItem } from "@modules/domain/decisions"
import { WorkspaceMailService } from "@modules/domain/email-messages"
import { WorkspacesService } from "@modules/domain/workspaces"
import { renderEmail } from "@modules/integrations/mail"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { WorkPerformersErrorCode } from "./errors/work-performers.error"
import { PerformerKitService } from "./performer-kit.service"
import { SendEmailPerformerService } from "./send-email-performer.service"
import { WorkPerformersLogEvent } from "./work-performers.log-events"

const ctx: WorkContext = { workspaceId: "ws-1", actor: "Lan", locale: "en" }

const itemOf = builder<WorkItem>({
    id: "item-1",
    workspace_id: "ws-1",
    department: "accounting",
    action: "send_email",
    subject_type: "invoice",
    subject_id: "inv-1",
    lead_id: "lead-1",
    inbound_event_id: null,
    parent_id: null,
    chain_id: "item-1",
    depth: 0,
    status: "queued",
    decided_path: null,
    reason: null,
    reasons: [],
    missing_fields: [],
    proposal: { summary: "Receipt", fields: {} },
    result: null,
    error: null,
    evidence_state: "pending",
    assigned_staff_id: null,
    execution_id: null,
    origin: "live",
    created_at: "2026-10-12T09:00:00.000Z",
    updated_at: "2026-10-12T09:00:00.000Z",
    completed_at: null,
    installation_id: null,
})

const proposalOf = (fields: Proposal["fields"] = {}, draft: string | undefined = "Thanks for paying"): Proposal => ({
    summary: "Receipt",
    draft,
    fields: { contact: " lan@huetea.vn ", subject: "Your receipt", purpose: "receipt", ...fields },
})

describe("SendEmailPerformerService", () => {
    const build = async () => {
        const logger = mock<Logger>()
        const kit = mock<PerformerKitService>()
        kit.text.mockImplementation((_ctx, key, params = {}) => [key, ...Object.values(params).map(String)].join("|"))
        const mail = mock<WorkspaceMailService>()
        mail.send.mockResolvedValue({ status: "sent", emailMessageId: "em-1", via: "workspace" })
        const workspaces = mock<WorkspacesService>()
        workspaces.nameOf.mockResolvedValue("Hue Tea")
        const moduleRef = await Test.createTestingModule({
            providers: [
                SendEmailPerformerService,
                { provide: LOGGER, useValue: logger },
                { provide: PerformerKitService, useValue: kit },
                { provide: WorkspaceMailService, useValue: mail },
                { provide: WorkspacesService, useValue: workspaces },
            ],
        }).compile()
        return { service: moduleRef.get(SendEmailPerformerService), logger, mail, workspaces }
    }

    it("prepares the proposal it was given", async () => {
        const { service } = await build()
        const item = itemOf()

        await expect(service.prepare(ctx, item)).resolves.toEqual({ proposal: item.proposal })
    })

    it("records a simulated email without sending it", async () => {
        const { service, mail } = await build()

        await expect(service.perform(ctx, itemOf({ origin: "simulated" }), proposalOf())).resolves.toEqual({
            summary: "simulatedDelivery|email",
            evidence: "captured",
            lead_id: "lead-1",
            detail: "Thanks for paying",
        })
        expect(mail.send).not.toHaveBeenCalled()
    })

    it("sends the email in the shop layout with the gate's proof and the references", async () => {
        const { service, mail } = await build()
        const rendered = renderEmail({
            shopName: "Hue Tea",
            title: "Your receipt",
            body: "Thanks for paying",
            footer: "emailFooter|Hue Tea",
            lang: "en",
        })

        await expect(service.perform(ctx, itemOf(), proposalOf({ refs: '{"invoice_id":"inv-1"}' }))).resolves.toEqual({
            summary: "emailSent|lan@huetea.vn|Your receipt",
            evidence: "captured",
            lead_id: "lead-1",
            detail: "Thanks for paying",
        })
        expect(mail.send).toHaveBeenCalledWith({
            workspaceId: "ws-1",
            to: "lan@huetea.vn",
            subject: "Your receipt",
            html: rendered.html,
            text: rendered.text,
            purpose: "receipt",
            refs: { invoice_id: "inv-1" },
            audience: "customer",
            workItemId: "item-1",
        })
    })

    it("uses the default shop name, purpose and an empty body when they are missing", async () => {
        const { service, mail, workspaces } = await build()
        workspaces.nameOf.mockResolvedValue("")
        const rendered = renderEmail({
            shopName: "NIVO",
            title: "Your receipt",
            body: "",
            footer: "emailFooter|NIVO",
            lang: "en",
        })

        const performed = await service.perform(ctx, itemOf(), { ...proposalOf({ purpose: null }), draft: undefined })

        expect(performed.detail).toBeNull()
        expect(mail.send.mock.calls[0]?.[0]).toMatchObject({
            html: rendered.html,
            purpose: "customer_email",
            refs: {},
        })
    })

    it("sends without references that are not an object", async () => {
        const { service, mail, logger } = await build()

        await service.perform(ctx, itemOf(), proposalOf({ refs: "[1,2]" }))

        expect(mail.send.mock.calls[0]?.[0].refs).toEqual({})
        expect(logger.error).not.toHaveBeenCalled()
    })

    it("logs unreadable references and sends without them", async () => {
        const { service, mail, logger } = await build()

        await service.perform(ctx, itemOf(), proposalOf({ refs: "{not json" }))

        expect(mail.send.mock.calls[0]?.[0].refs).toEqual({})
        expect(logger.error.mock.calls[0]?.[0]).toBe(WorkPerformersLogEvent.RefsUnreadable)
        expect(logger.error.mock.calls[0]?.[2]).toEqual({ workItemId: "item-1" })
    })

    it("fails the item with the reason when the email did not go out", async () => {
        const { service, mail } = await build()
        mail.send
            .mockResolvedValueOnce({ status: "failed", emailMessageId: null, via: "workspace", error: "smtp down" })
            .mockResolvedValueOnce({ status: "no_smtp", emailMessageId: null, via: "none" })

        await expect(service.perform(ctx, itemOf(), proposalOf())).rejects.toMatchObject({
            code: WorkPerformersErrorCode.EmailNotSent,
            params: { reason: "smtp down" },
        })
        await expect(service.perform(ctx, itemOf(), proposalOf())).rejects.toMatchObject({
            code: WorkPerformersErrorCode.EmailNotSent,
            params: { reason: "no_smtp" },
        })
    })

    it("captures a simulated email with no draft without looking up the shop", async () => {
        const { service, mail, workspaces } = await build()

        await expect(
            service.perform(ctx, itemOf({ origin: "simulated", lead_id: null }), { summary: "Receipt", fields: {} }),
        ).resolves.toEqual({
            summary: "simulatedDelivery|email",
            evidence: "captured",
            lead_id: null,
            detail: null,
        })
        expect(workspaces.nameOf).not.toHaveBeenCalled()
        expect(mail.send).not.toHaveBeenCalled()
    })

    it.each(["null", '"invoice-1"', "42", "true"])("sends without references when JSON is %s", async (refs) => {
        const { service, mail, logger } = await build()

        await expect(service.perform(ctx, itemOf(), proposalOf({ refs }))).resolves.toEqual({
            summary: "emailSent|lan@huetea.vn|Your receipt",
            evidence: "captured",
            lead_id: "lead-1",
            detail: "Thanks for paying",
        })
        expect(mail.send.mock.calls[0]?.[0].refs).toEqual({})
        expect(logger.error).not.toHaveBeenCalled()
    })
})
