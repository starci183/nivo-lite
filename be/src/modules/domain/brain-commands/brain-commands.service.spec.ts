import { Test } from "@nestjs/testing"
import { fakeTransaction, mock, mockEntityManager, recordingQueueOutbox } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { QUEUE_OUTBOX } from "@modules/platform/queue"
import { KNOWLEDGE_QUEUE } from "@modules/queues/knowledge"
import { BrainCommandsService } from "./brain-commands.service"
import {
    BEGIN_COMMAND,
    FAIL_COMMAND,
    FINISH_COMMAND,
    INSERT_COMMAND,
    SELECT_COMMAND,
    SELECT_COMMAND_STATE,
} from "./persistence/brain-commands.sql"

const build = async (entityManager: MockEntityManager) => {
    const tx = fakeTransaction(entityManager)
    const members = mock<WorkspaceMembersService>()
    const outbox = recordingQueueOutbox()
    const moduleRef = await Test.createTestingModule({
        providers: [
            BrainCommandsService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: tx.em },
            { provide: WorkspaceMembersService, useValue: members },
            { provide: QUEUE_OUTBOX, useValue: outbox },
        ],
    }).compile()
    return { commands: moduleRef.get(BrainCommandsService), tx, members, outbox }
}

describe("BrainCommandsService", () => {
    describe("request", () => {
        it("writes the command and its job in one transaction and answers its id", async () => {
            const { commands, tx, members, outbox } = await build(
                mockEntityManager({ query: [INSERT_COMMAND, [{ id: "cmd-1" }]] }),
            )

            await expect(commands.request("user-1", "ws-1", "reindex", { source: "s-1" })).resolves.toBe("cmd-1")

            expect(members.require).toHaveBeenCalledWith("user-1", "ws-1")
            expect(tx.committedWrites).toEqual([
                { method: "query", args: [INSERT_COMMAND, ["ws-1", "user-1", "reindex", '{"source":"s-1"}']] },
            ])
            expect(outbox.jobsOf(KNOWLEDGE_QUEUE)).toEqual([
                { queue: KNOWLEDGE_QUEUE, payload: { commandId: "cmd-1", workspaceId: "ws-1" } },
            ])
            expect(outbox.allInTransaction).toBe(true)
        })

        it("writes nothing for someone who is not a member", async () => {
            const { commands, tx, members, outbox } = await build(mockEntityManager())
            const refusal = new Error("not a member")
            members.require.mockRejectedValue(refusal)

            await expect(commands.request("user-1", "ws-1", "reindex", {})).rejects.toBe(refusal)
            expect(tx.outcomes).toEqual([])
            expect(outbox.jobs).toEqual([])
        })
    })

    describe("stateOf", () => {
        it("answers how the command of the person stands, or nothing for a command they did not ask", async () => {
            const em = mockEntityManager({
                query: [
                    [SELECT_COMMAND_STATE, [{ status: "failed", result: null, error_code: "BRAIN_FAILED" }]],
                    [SELECT_COMMAND_STATE, []],
                ],
            })
            const { commands } = await build(em)

            await expect(commands.stateOf("user-1", "ws-1", "cmd-1")).resolves.toEqual({
                status: "failed",
                result: null,
                errorCode: "BRAIN_FAILED",
            })
            await expect(commands.stateOf("user-2", "ws-1", "cmd-1")).resolves.toBeNull()
            expect(em.query).toHaveBeenCalledWith(SELECT_COMMAND_STATE, ["ws-1", "cmd-1", "user-2"])
        })
    })

    describe("get", () => {
        it("answers the command, or nothing when it is not there", async () => {
            const em = mockEntityManager({
                query: [
                    [
                        SELECT_COMMAND,
                        [
                            {
                                id: "cmd-1",
                                workspace_id: "ws-1",
                                requested_by: "user-1",
                                kind: "reindex",
                                payload: { source: "s-1" },
                                status: "queued",
                            },
                        ],
                    ],
                    [SELECT_COMMAND, []],
                ],
            })
            const { commands } = await build(em)

            await expect(commands.get("ws-1", "cmd-1")).resolves.toEqual({
                id: "cmd-1",
                workspaceId: "ws-1",
                requestedBy: "user-1",
                kind: "reindex",
                payload: { source: "s-1" },
                status: "queued",
            })
            await expect(commands.get("ws-1", "cmd-9")).resolves.toBeNull()
        })
    })

    describe("begin, finish and fail", () => {
        it("takes an open command and refuses a closed one", async () => {
            const em = mockEntityManager({
                query: [
                    [BEGIN_COMMAND, [{ id: "cmd-1" }]],
                    [BEGIN_COMMAND, []],
                ],
            })
            const { commands } = await build(em)

            await expect(commands.begin("ws-1", "cmd-1")).resolves.toBe(true)
            await expect(commands.begin("ws-1", "cmd-1")).resolves.toBe(false)
        })

        it("closes a command with its result or its stored code", async () => {
            const em = mockEntityManager({
                query: [
                    [FINISH_COMMAND, []],
                    [FAIL_COMMAND, []],
                ],
            })
            const { commands } = await build(em)

            await commands.finish("ws-1", "cmd-1", { facts: 3 })
            await commands.fail("ws-1", "cmd-2", "BRAIN_FAILED")

            expect(em.query.mock.calls).toEqual([
                [FINISH_COMMAND, ["ws-1", "cmd-1", '{"facts":3}']],
                [FAIL_COMMAND, ["ws-1", "cmd-2", "BRAIN_FAILED"]],
            ])
        })
    })
})
