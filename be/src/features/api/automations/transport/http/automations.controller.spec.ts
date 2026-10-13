import type { CommandBus, QueryBus } from "@nestjs/cqrs"
import { mock } from "@starci/jest-preset"
import type { AutomationCard, AutomationsOverview } from "@modules/domain/automations"
import type { Principal } from "@modules/platform/cqrs"
import { buildTemplate } from "@tests/fixtures/builders/automations.builder"
import { EmitEventCommand } from "../../application/emit-event.command"
import { GetAutomationsQuery } from "../../application/get-automations.query"
import { ListGoogleAccountsQuery } from "../../application/list-google-accounts.query"
import { ListRunsQuery } from "../../application/list-runs.query"
import { ProposeBodyCommand } from "../../application/propose-body.command"
import { RunNowCommand } from "../../application/run-now.command"
import { SuggestAutomationsQuery } from "../../application/suggest-automations.query"
import { UpdatePipelineCommand } from "../../application/update-pipeline.command"
import { AutomationsController } from "./automations.controller"

const PRINCIPAL: Principal = { id: "u-1", email: "owner@example.com", role: "authenticated" }
const RUN_MESSAGE = "Thank you"

const build = () => {
    const queryBus = mock<QueryBus>()
    const commandBus = mock<CommandBus>()
    const controller = new AutomationsController(queryBus, commandBus)
    return { controller, queryBus, commandBus }
}

describe("AutomationsController", () => {
    it("reads the overview for the principal and workspace", async () => {
        const { controller, queryBus } = build()
        const overview: AutomationsOverview = {
            cards: [],
            runs: [],
            shop: { shop: "Flower Shop", hours: "08:00 - 21:00", tone: "friendly" },
            sample: { variables: { customer: "Lan" }, neutral: { customer: "customer" } },
        }
        queryBus.execute.mockResolvedValue(overview)

        await expect(controller.overview(PRINCIPAL, "ws-1")).resolves.toEqual(overview)

        expect(queryBus.execute).toHaveBeenCalledTimes(1)
        expect(queryBus.execute).toHaveBeenCalledWith(
            new GetAutomationsQuery({ request: { workspaceId: "ws-1" }, principal: PRINCIPAL }),
        )
    })

    it("reads the run history with the requested template", async () => {
        const { controller, queryBus } = build()
        const runs = [
            {
                id: "run-1",
                pipelineId: "pipeline-1",
                templateKey: "thank_payment",
                status: "done",
                triggerRef: "payment-1",
                summary: "Payment received",
                steps: [],
                evidence: "Invoice paid",
                error: null,
                createdAt: "2026-10-12T10:00:00.000Z",
                finishedAt: "2026-10-12T10:01:00.000Z",
                workItemId: null,
                message: RUN_MESSAGE,
            },
        ]
        queryBus.execute.mockResolvedValue(runs)

        await expect(controller.runs(PRINCIPAL, "ws-1", { template: "thank_payment" })).resolves.toEqual(runs)

        expect(queryBus.execute).toHaveBeenCalledTimes(1)
        expect(queryBus.execute).toHaveBeenCalledWith(
            new ListRunsQuery({
                request: { workspaceId: "ws-1", templateKey: "thank_payment" },
                principal: PRINCIPAL,
            }),
        )
    })

    it("reads the Google accounts for the workspace", async () => {
        const { controller, queryBus } = build()
        const accounts = [{ id: "google-1", email: "shop@example.com", status: "active" }]
        queryBus.execute.mockResolvedValue(accounts)

        await expect(controller.googleAccounts(PRINCIPAL, "ws-1")).resolves.toEqual(accounts)

        expect(queryBus.execute).toHaveBeenCalledTimes(1)
        expect(queryBus.execute).toHaveBeenCalledWith(
            new ListGoogleAccountsQuery({ request: { workspaceId: "ws-1" }, principal: PRINCIPAL }),
        )
    })

    it("reads the suggestions for the requested module", async () => {
        const { controller, queryBus } = build()
        const suggestions = [
            {
                key: "thank_payment",
                name: { vi: "Cam on", en: "Thank you" },
                reason: { vi: "Da thanh toan", en: "Payment received" },
            },
        ]
        queryBus.execute.mockResolvedValue(suggestions)

        await expect(controller.suggestions(PRINCIPAL, "ws-1", { module: "sales" })).resolves.toEqual(
            suggestions,
        )

        expect(queryBus.execute).toHaveBeenCalledTimes(1)
        expect(queryBus.execute).toHaveBeenCalledWith(
            new SuggestAutomationsQuery({
                request: { workspaceId: "ws-1", moduleKey: "sales" },
                principal: PRINCIPAL,
            }),
        )
    })

    it("emits the mapped business event", async () => {
        const { controller, commandBus } = build()
        commandBus.execute.mockResolvedValue(undefined)

        await expect(
            controller.emit(PRINCIPAL, "ws-1", {
                event: "payment.received",
                data: { invoiceId: "invoice-1", amountVnd: 250000 },
                dedupe: "payment-1",
            }),
        ).resolves.toBeUndefined()

        expect(commandBus.execute).toHaveBeenCalledTimes(1)
        expect(commandBus.execute).toHaveBeenCalledWith(
            new EmitEventCommand({
                request: {
                    workspaceId: "ws-1",
                    event: {
                        event: "payment.received",
                        data: { invoiceId: "invoice-1", amountVnd: 250000 },
                        dedupe: "payment-1",
                    },
                },
                principal: PRINCIPAL,
            }),
        )
    })

    it("updates the selected pipeline with the mapped patch", async () => {
        const { controller, commandBus } = build()
        const card: AutomationCard = {
            key: "thank_payment",
            def: buildTemplate(),
            pipelineId: "pipeline-1",
            enabled: true,
            dismissed: false,
            config: { days: 3 },
            body: "Thank you, {customer}",
            bodyVersion: 1,
            basedOnContext: 2,
            currentContext: 2,
            bodyStale: false,
            gate: "ask",
            missing: [],
            proposed: true,
            comingSoon: false,
            lastRunAt: null,
            runCount: 0,
            trust: { streak: 1, offered: false, autoSend: false },
        }
        commandBus.execute.mockResolvedValue(card)

        await expect(
            controller.update(
                PRINCIPAL,
                "ws-1",
                { key: "thank_payment" },
                {
                    enabled: true,
                    dismissed: false,
                    values: { days: 3 },
                    body: "Thank you, {customer}",
                    autoSend: false,
                    googleConnectionId: "google-1",
                },
            ),
        ).resolves.toEqual(card)

        expect(commandBus.execute).toHaveBeenCalledTimes(1)
        expect(commandBus.execute).toHaveBeenCalledWith(
            new UpdatePipelineCommand({
                request: {
                    workspaceId: "ws-1",
                    templateKey: "thank_payment",
                    patch: {
                        enabled: true,
                        dismissed: false,
                        values: { days: 3 },
                        body: "Thank you, {customer}",
                        autoSend: false,
                        googleConnectionId: "google-1",
                    },
                },
                principal: PRINCIPAL,
            }),
        )
    })

    it("returns the body proposal for the selected template", async () => {
        const { controller, commandBus } = build()
        const proposal = { body: "Thank you, {customer}", generated: true, contextVersion: 2 }
        commandBus.execute.mockResolvedValue(proposal)

        await expect(controller.proposeBody(PRINCIPAL, "ws-1", { key: "thank_payment" })).resolves.toEqual(
            proposal,
        )

        expect(commandBus.execute).toHaveBeenCalledTimes(1)
        expect(commandBus.execute).toHaveBeenCalledWith(
            new ProposeBodyCommand({
                request: { workspaceId: "ws-1", templateKey: "thank_payment" },
                principal: PRINCIPAL,
            }),
        )
    })

    it("runs the selected template once", async () => {
        const { controller, commandBus } = build()
        commandBus.execute.mockResolvedValue(undefined)

        await expect(controller.runNow(PRINCIPAL, "ws-1", { key: "thank_payment" })).resolves.toBeUndefined()

        expect(commandBus.execute).toHaveBeenCalledTimes(1)
        expect(commandBus.execute).toHaveBeenCalledWith(
            new RunNowCommand({
                request: { workspaceId: "ws-1", templateKey: "thank_payment" },
                principal: PRINCIPAL,
            }),
        )
    })

    it("propagates query failures", async () => {
        const { controller, queryBus } = build()
        const error = new Error("Overview unavailable")
        queryBus.execute.mockRejectedValue(error)

        await expect(controller.overview(PRINCIPAL, "ws-1")).rejects.toBe(error)
    })

    it("propagates command failures", async () => {
        const { controller, commandBus } = build()
        const error = new Error("Run unavailable")
        commandBus.execute.mockRejectedValue(error)

        await expect(controller.runNow(PRINCIPAL, "ws-1", { key: "thank_payment" })).rejects.toBe(error)
    })
})
