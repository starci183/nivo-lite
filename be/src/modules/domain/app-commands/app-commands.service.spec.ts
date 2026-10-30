import { Test } from "@nestjs/testing"
import { evaluatedValues } from "@tests/fixtures/builders/evaluated-calls.builder"
import { builder, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { In } from "typeorm"
import { failedSettlement } from "@tests/fixtures/builders/app-commands.builder"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { AppCommandsService } from "./app-commands.service"
import { AppCommandEntity } from "./persistence/entities"

/** Stands for the `() => "now()"` expression a write hands the database. */
const SQL_EXPRESSION: unknown = expect.any(Function)

const commandOf = builder<AppCommandEntity>({
    id: "command-1",
    workspaceId: "workspace-1",
    requestedBy: "person-1",
    kind: "invite.create",
    input: { email: "invitee@example.com", role: "member" },
    state: "running",
    result: null,
    errorCode: null,
    createdAt: new Date("2026-10-12T10:00:00Z"),
    finishedAt: null,
    updatedAt: new Date("2026-10-12T10:00:00Z"),
})

const OPEN = { id: "command-1", state: In(["queued", "running"]) }

async function serviceOf(em: MockEntityManager): Promise<AppCommandsService> {
    const moduleRef = await Test.createTestingModule({
        providers: [AppCommandsService, { provide: PRIMARY_ENTITY_MANAGER, useValue: em }],
    }).compile()
    return moduleRef.get(AppCommandsService)
}

describe("AppCommandsService", () => {
    it("begins the command and maps its persisted columns", async () => {
        const em = mockEntityManager({
            update: [AppCommandEntity, { affected: 1 }],
            findOne: [AppCommandEntity, commandOf()],
        })
        const service = await serviceOf(em)

        await expect(service.begin("command-1")).resolves.toEqual({
            id: "command-1",
            workspaceId: "workspace-1",
            requestedBy: "person-1",
            kind: "invite.create",
            input: { email: "invitee@example.com", role: "member" },
        })
        expect(em.update).toHaveBeenCalledWith(AppCommandEntity, OPEN, { state: "running" })
        expect(em.findOne).toHaveBeenCalledWith(AppCommandEntity, { where: { id: "command-1" } })
    })
})

describe("AppCommandsService", () => {
    it("preserves a command without a workspace and with an empty record", async () => {
        const em = mockEntityManager({
            update: [AppCommandEntity, { affected: 1 }],
            findOne: [AppCommandEntity, Object.assign(commandOf(), { workspaceId: null, input: {} })],
        })
        const service = await serviceOf(em)

        await expect(service.begin("command-1")).resolves.toEqual({
            id: "command-1",
            workspaceId: null,
            requestedBy: "person-1",
            kind: "invite.create",
            input: {},
        })
    })
})

describe("AppCommandsService", () => {
    it.each([
        { input: null },
        { input: undefined },
        { input: [] },
        { input: ["email"] },
        { input: "email" },
        { input: 12 },
        { input: false },
    ])("uses an empty input for persisted $input", async ({ input }) => {
        const em = mockEntityManager({
            update: [AppCommandEntity, { affected: 1 }],
            findOne: [AppCommandEntity, Object.assign(commandOf(), { input })],
        })
        const service = await serviceOf(em)

        await expect(service.begin("command-1")).resolves.toEqual({
            id: "command-1",
            workspaceId: "workspace-1",
            requestedBy: "person-1",
            kind: "invite.create",
            input: {},
        })
    })
})

describe("AppCommandsService", () => {
    it.each(["unknown-command", "settled-command"])("returns null when %s has no eligible row", async (commandId) => {
        const em = mockEntityManager({ update: [AppCommandEntity, { affected: 0 }] })
        const service = await serviceOf(em)

        await expect(service.begin(commandId)).resolves.toBeNull()

        expect(em.update).toHaveBeenCalledWith(
            AppCommandEntity,
            { id: commandId, state: In(["queued", "running"]) },
            expect.anything(),
        )
        expect(em.findOne).not.toHaveBeenCalled()
    })

    it("returns null when the claimed command is gone before it is read", async () => {
        const em = mockEntityManager({
            update: [AppCommandEntity, { affected: 1 }],
            findOne: [AppCommandEntity, null],
        })
        const service = await serviceOf(em)

        await expect(service.begin("command-1")).resolves.toBeNull()
    })
})

describe("AppCommandsService", () => {
    it("settles a successful command with its JSON result", async () => {
        const em = mockEntityManager({ update: [AppCommandEntity, { affected: 1 }] })
        const service = await serviceOf(em)
        const result = { inviteId: "invite-1", url: "https://example.com/invite", sent: true }

        await expect(service.succeed("command-1", result)).resolves.toBeUndefined()

        const settlement = { state: "done", result, errorCode: null, finishedAt: SQL_EXPRESSION }
        expect(em.update.mock.calls).toEqual([[AppCommandEntity, OPEN, settlement]])
    })
})

describe("AppCommandsService", () => {
    it("settles a failed command with the exact domain code", async () => {
        const em = mockEntityManager({ update: [AppCommandEntity, { affected: 1 }] })
        const service = await serviceOf(em)

        await expect(service.fail("command-1", "INVITE_EXPIRED")).resolves.toBeUndefined()

        expect(em.update.mock.calls).toEqual([[AppCommandEntity, OPEN, failedSettlement("INVITE_EXPIRED")]])
    })

    it("keeps only the first eighty characters of a long code", async () => {
        const em = mockEntityManager({ update: [AppCommandEntity, { affected: 1 }] })
        const service = await serviceOf(em)

        await service.fail("command-1", "X".repeat(100))

        expect(em.update.mock.calls[0]?.[2]).toMatchObject({ errorCode: "X".repeat(80) })
    })
})

describe("AppCommandsService", () => {
    it("rethrows a begin failure", async () => {
        const em = mockEntityManager({
            update: [AppCommandEntity, { affected: 1 }],
            findOne: [AppCommandEntity, commandOf()],
        })
        const error = new Error("begin unavailable")
        em.update.mockRejectedValueOnce(error)
        const service = await serviceOf(em)

        await expect(service.begin("command-1")).rejects.toBe(error)
    })

    it("rethrows a success failure", async () => {
        const em = mockEntityManager({ update: [AppCommandEntity, {}] })
        const error = new Error("success unavailable")
        em.update.mockRejectedValueOnce(error)
        const service = await serviceOf(em)

        await expect(service.succeed("command-1", {})).rejects.toBe(error)
    })

    it("rethrows an error while recording failure", async () => {
        const em = mockEntityManager({ update: [AppCommandEntity, {}] })
        const error = new Error("failure unavailable")
        em.update.mockRejectedValueOnce(error)
        const service = await serviceOf(em)

        await expect(service.fail("command-1", "INVITE_EXPIRED")).rejects.toBe(error)
    })
})

/** The `finishedAt` expression of the settling write, asked for the SQL it hands the database. */
const clockOf = (em: MockEntityManager): unknown => evaluatedValues(em.update.mock.calls[0]?.[2]).finishedAt

describe("AppCommandsService database clock", () => {
    it("stamps a settled command with the database time", async () => {
        const done = mockEntityManager({ update: [AppCommandEntity, { affected: 1 }] })
        const failed = mockEntityManager({ update: [AppCommandEntity, { affected: 1 }] })

        await (await serviceOf(done)).succeed("command-1", { sent: true })
        await (await serviceOf(failed)).fail("command-1", "INVITE_EXPIRED")

        expect(clockOf(done)).toBe("now()")
        expect(clockOf(failed)).toBe("now()")
    })
})
