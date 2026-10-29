import { Test } from "@nestjs/testing"
import { FakeClock, mock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { AutomationsError, AutomationsErrorCode, AutomationsService } from "@modules/domain/automations"
import { CLOCK } from "@modules/platform/clock"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { AutomationCommandsService } from "./automation-commands.service"
import { AutomationCommandEntity } from "./persistence/entities"

const NOW = "2026-10-13T10:00:00.000Z"
const COMMAND_ID = "a1234567-b123-c123-d123-e123456789ab"
const PAYLOAD = { commandId: COMMAND_ID }
const RUN_NOW = Object.assign(new AutomationCommandEntity(), {
    id: COMMAND_ID,
    workspaceId: "workspace-1",
    kind: "run_now",
    templateKey: "weekly_summary",
    status: "queued",
    result: null,
    faultCode: null,
    createdBy: "manager-1",
    createdAt: new Date("2026-10-13T09:00:00.000Z"),
    finishedAt: null,
})
const PROPOSE_BODY = Object.assign(new AutomationCommandEntity(), RUN_NOW, { kind: "propose_body" })
const QUEUED_WHERE = { where: { id: COMMAND_ID, status: "queued" } }
const settled = (status: string, result: object | null, faultCode: string | null) => [
    AutomationCommandEntity,
    { id: COMMAND_ID, status: "queued" },
    { status, result, faultCode, finishedAt: new Date(NOW) },
]

const build = async (em: MockEntityManager) => {
    const automations = mock<AutomationsService>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            AutomationCommandsService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: em },
            { provide: CLOCK, useValue: new FakeClock(NOW) },
            { provide: AutomationsService, useValue: automations },
        ],
    }).compile()
    return { commands: moduleRef.get(AutomationCommandsService), automations }
}

describe("AutomationCommandsService", () => {
    describe("execute", () => {
        it("does nothing and queries nothing when the payload names no command", async () => {
            const em = mockEntityManager()
            const { commands, automations } = await build(em)

            await expect(commands.execute({})).resolves.toBeUndefined()

            expect(em.findOne).not.toHaveBeenCalled()
            expect(automations.runNow).not.toHaveBeenCalled()
            expect(automations.proposeBody).not.toHaveBeenCalled()
        })

        it("does nothing after selecting when no queued command exists", async () => {
            const em = mockEntityManager({ findOne: [AutomationCommandEntity, null] })
            const { commands, automations } = await build(em)

            await expect(commands.execute(PAYLOAD)).resolves.toBeUndefined()

            expect(em.findOne).toHaveBeenCalledTimes(1)
            expect(em.findOne).toHaveBeenCalledWith(AutomationCommandEntity, QUEUED_WHERE)
            expect(automations.runNow).not.toHaveBeenCalled()
            expect(automations.proposeBody).not.toHaveBeenCalled()
        })

        it("runs the queued workflow as its creator and settles done at the clock time", async () => {
            const em = mockEntityManager({
                findOne: [AutomationCommandEntity, RUN_NOW],
                update: [AutomationCommandEntity, {}],
            })
            const { commands, automations } = await build(em)
            automations.runNow.mockResolvedValue()

            await expect(commands.execute(PAYLOAD)).resolves.toBeUndefined()

            expect(automations.runNow).toHaveBeenCalledTimes(1)
            expect(automations.runNow).toHaveBeenCalledWith("manager-1", "workspace-1", "weekly_summary")
            expect(automations.proposeBody).not.toHaveBeenCalled()
            expect(em.findOne).toHaveBeenCalledWith(AutomationCommandEntity, QUEUED_WHERE)
            expect(em.update.mock.calls).toEqual([settled("done", {}, null)])
        })
    })
})

describe("AutomationCommandsService", () => {
    describe("execute", () => {
        it("proposes the wording as its creator and settles done with the body and generated flag", async () => {
            const em = mockEntityManager({
                findOne: [AutomationCommandEntity, PROPOSE_BODY],
                update: [AutomationCommandEntity, {}],
            })
            const { commands, automations } = await build(em)
            automations.proposeBody.mockResolvedValue({
                body: "Thanks for your payment.",
                generated: true,
                contextVersion: 3,
            })

            await expect(commands.execute(PAYLOAD)).resolves.toBeUndefined()

            expect(automations.proposeBody).toHaveBeenCalledTimes(1)
            expect(automations.proposeBody).toHaveBeenCalledWith("manager-1", "workspace-1", "weekly_summary")
            expect(automations.runNow).not.toHaveBeenCalled()
            expect(em.findOne).toHaveBeenCalledWith(AutomationCommandEntity, QUEUED_WHERE)
            expect(em.update.mock.calls).toEqual([
                settled("done", { body: "Thanks for your payment.", generated: true }, null),
            ])
        })

        it("settles an automations error as failed with its code and no result", async () => {
            const em = mockEntityManager({
                findOne: [AutomationCommandEntity, RUN_NOW],
                update: [AutomationCommandEntity, {}],
            })
            const { commands, automations } = await build(em)
            const failure = new AutomationsError({ code: AutomationsErrorCode.PipelineOff })
            automations.runNow.mockRejectedValue(failure)

            await expect(commands.execute(PAYLOAD)).resolves.toBeUndefined()

            expect(automations.runNow).toHaveBeenCalledTimes(1)
            expect(automations.runNow).toHaveBeenCalledWith("manager-1", "workspace-1", "weekly_summary")
            expect(automations.proposeBody).not.toHaveBeenCalled()
            expect(em.findOne).toHaveBeenCalledWith(AutomationCommandEntity, QUEUED_WHERE)
            expect(em.update.mock.calls).toEqual([settled("failed", null, "AUTOMATIONS_PIPELINE_OFF")])
        })

        it("rethrows any other failure without settling the command", async () => {
            const em = mockEntityManager({ findOne: [AutomationCommandEntity, PROPOSE_BODY] })
            const { commands, automations } = await build(em)
            const failure = new Error("proposal unavailable")
            automations.proposeBody.mockRejectedValue(failure)

            await expect(commands.execute(PAYLOAD)).rejects.toBe(failure)

            expect(automations.proposeBody).toHaveBeenCalledTimes(1)
            expect(automations.proposeBody).toHaveBeenCalledWith("manager-1", "workspace-1", "weekly_summary")
            expect(automations.runNow).not.toHaveBeenCalled()
            expect(em.findOne).toHaveBeenCalledTimes(1)
            expect(em.update).not.toHaveBeenCalled()
        })
    })
})
