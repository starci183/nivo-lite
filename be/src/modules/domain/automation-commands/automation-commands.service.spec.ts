import { Test } from "@nestjs/testing"
import { FakeClock, mock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { AutomationsError, AutomationsErrorCode, AutomationsService } from "@modules/domain/automations"
import { CLOCK } from "@modules/platform/clock"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import type { CommandRow } from "./automation-commands.contracts"
import { AutomationCommandsService } from "./automation-commands.service"
import { SELECT_QUEUED_COMMAND, SETTLE_COMMAND } from "./persistence/automation-commands.sql"

const NOW = "2026-10-13T10:00:00.000Z"
const COMMAND_ID = "a1234567-b123-c123-d123-e123456789ab"
const PAYLOAD = { commandId: COMMAND_ID }
const RUN_NOW: CommandRow = {
    id: COMMAND_ID,
    workspace_id: "workspace-1",
    kind: "run_now",
    template_key: "weekly_summary",
    created_by: "manager-1",
}
const PROPOSE_BODY: CommandRow = { ...RUN_NOW, kind: "propose_body" }

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

            expect(em.query).not.toHaveBeenCalled()
            expect(automations.runNow).not.toHaveBeenCalled()
            expect(automations.proposeBody).not.toHaveBeenCalled()
        })

        it("does nothing after selecting when no queued command exists", async () => {
            const em = mockEntityManager({ query: [SELECT_QUEUED_COMMAND, []] })
            const { commands, automations } = await build(em)

            await expect(commands.execute(PAYLOAD)).resolves.toBeUndefined()

            expect(em.query).toHaveBeenCalledTimes(1)
            expect(em.query).toHaveBeenCalledWith(SELECT_QUEUED_COMMAND, [COMMAND_ID])
            expect(automations.runNow).not.toHaveBeenCalled()
            expect(automations.proposeBody).not.toHaveBeenCalled()
        })

        it("runs the queued workflow as its creator and settles done at the clock time", async () => {
            const em = mockEntityManager({
                query: [
                    [SELECT_QUEUED_COMMAND, [RUN_NOW]],
                    [SETTLE_COMMAND, []],
                ],
            })
            const { commands, automations } = await build(em)
            automations.runNow.mockResolvedValue()

            await expect(commands.execute(PAYLOAD)).resolves.toBeUndefined()

            expect(automations.runNow).toHaveBeenCalledTimes(1)
            expect(automations.runNow).toHaveBeenCalledWith("manager-1", "workspace-1", "weekly_summary")
            expect(automations.proposeBody).not.toHaveBeenCalled()
            expect(em.query).toHaveBeenCalledTimes(2)
            expect(em.query).toHaveBeenNthCalledWith(1, SELECT_QUEUED_COMMAND, [COMMAND_ID])
            expect(em.query).toHaveBeenNthCalledWith(2, SETTLE_COMMAND, [COMMAND_ID, "done", "{}", null, new Date(NOW)])
        })
    })
})

describe("AutomationCommandsService", () => {
    describe("execute", () => {
        it("proposes the wording as its creator and settles done with the body and generated flag", async () => {
            const em = mockEntityManager({
                query: [
                    [SELECT_QUEUED_COMMAND, [PROPOSE_BODY]],
                    [SETTLE_COMMAND, []],
                ],
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
            expect(em.query).toHaveBeenCalledTimes(2)
            expect(em.query).toHaveBeenNthCalledWith(1, SELECT_QUEUED_COMMAND, [COMMAND_ID])
            expect(em.query).toHaveBeenNthCalledWith(2, SETTLE_COMMAND, [
                COMMAND_ID,
                "done",
                '{"body":"Thanks for your payment.","generated":true}',
                null,
                new Date(NOW),
            ])
        })

        it("settles an automations error as failed with its code and no result", async () => {
            const em = mockEntityManager({
                query: [
                    [SELECT_QUEUED_COMMAND, [RUN_NOW]],
                    [SETTLE_COMMAND, []],
                ],
            })
            const { commands, automations } = await build(em)
            const failure = new AutomationsError({ code: AutomationsErrorCode.PipelineOff })
            automations.runNow.mockRejectedValue(failure)

            await expect(commands.execute(PAYLOAD)).resolves.toBeUndefined()

            expect(automations.runNow).toHaveBeenCalledTimes(1)
            expect(automations.runNow).toHaveBeenCalledWith("manager-1", "workspace-1", "weekly_summary")
            expect(automations.proposeBody).not.toHaveBeenCalled()
            expect(em.query).toHaveBeenCalledTimes(2)
            expect(em.query).toHaveBeenNthCalledWith(1, SELECT_QUEUED_COMMAND, [COMMAND_ID])
            expect(em.query).toHaveBeenNthCalledWith(2, SETTLE_COMMAND, [
                COMMAND_ID,
                "failed",
                null,
                "AUTOMATIONS_PIPELINE_OFF",
                new Date(NOW),
            ])
        })

        it("rethrows any other failure without settling the command", async () => {
            const em = mockEntityManager({ query: [SELECT_QUEUED_COMMAND, [PROPOSE_BODY]] })
            const { commands, automations } = await build(em)
            const failure = new Error("proposal unavailable")
            automations.proposeBody.mockRejectedValue(failure)

            await expect(commands.execute(PAYLOAD)).rejects.toBe(failure)

            expect(automations.proposeBody).toHaveBeenCalledTimes(1)
            expect(automations.proposeBody).toHaveBeenCalledWith("manager-1", "workspace-1", "weekly_summary")
            expect(automations.runNow).not.toHaveBeenCalled()
            expect(em.query).toHaveBeenCalledTimes(1)
            expect(em.query).toHaveBeenCalledWith(SELECT_QUEUED_COMMAND, [COMMAND_ID])
        })
    })
})
