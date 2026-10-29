import { Test } from "@nestjs/testing"
import { mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { In } from "typeorm"
import { fakeQueryBuilder } from "@tests/fixtures/builders/entity-query-builder-fake.builder"
import { failedSettlement } from "@tests/fixtures/builders/app-commands.builder"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { AppCommandsService } from "./app-commands.service"
import { AppCommandEntity } from "./persistence/entities"

/** Stands for the `() => "now()"` expression a write hands the database. */
const SQL_EXPRESSION: unknown = expect.any(Function)

const rowOf = (overrides: Record<string, unknown> = {}) => ({
    id: "command-1",
    workspace_id: "workspace-1",
    requested_by: "person-1",
    kind: "invite.create",
    input: { email: "invitee@example.com", role: "member" },
    ...overrides,
})

const OPEN = { id: "command-1", state: In(["queued", "running"]) }

async function serviceOf(em: MockEntityManager): Promise<AppCommandsService> {
    const moduleRef = await Test.createTestingModule({
        providers: [AppCommandsService, { provide: PRIMARY_ENTITY_MANAGER, useValue: em }],
    }).compile()
    return moduleRef.get(AppCommandsService)
}

/** A manager whose claiming update answers `raw`; the fake records the chained calls. */
const beginning = (raw: ReadonlyArray<unknown>) => {
    const em = mockEntityManager()
    const fake = fakeQueryBuilder({ execute: { raw, affected: raw.length } })
    em.createQueryBuilder.mockReturnValue(fake.builder)
    return { em, fake }
}

describe("AppCommandsService", () => {
    it("begins the command and maps its persisted columns", async () => {
        const { em, fake } = beginning([rowOf()])
        const service = await serviceOf(em)

        await expect(service.begin("command-1")).resolves.toEqual({
            id: "command-1",
            workspaceId: "workspace-1",
            requestedBy: "person-1",
            kind: "invite.create",
            input: { email: "invitee@example.com", role: "member" },
        })
        expect(em.createQueryBuilder).toHaveBeenCalledWith(AppCommandEntity, "ac")
        expect(fake.callsOf("set")).toEqual([[{ state: "running" }]])
        expect(fake.callsOf("where")).toEqual([[OPEN]])
        expect(fake.callsOf("returning")).toEqual([["id, workspace_id, requested_by, kind, input"]])
    })
})

describe("AppCommandsService", () => {
    it("preserves a command without a workspace and with an empty record", async () => {
        const { em } = beginning([rowOf({ workspace_id: null, input: {} })])
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
        const { em } = beginning([rowOf({ input })])
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
        const { em, fake } = beginning([])
        const service = await serviceOf(em)

        await expect(service.begin(commandId)).resolves.toBeNull()

        expect(fake.callsOf("where")).toEqual([[{ id: commandId, state: In(["queued", "running"]) }]])
    })
})

describe("AppCommandsService", () => {
    it("settles a successful command with its JSON result", async () => {
        const em = mockEntityManager({ update: [AppCommandEntity, { affected: 1 }] })
        const service = await serviceOf(em)
        const result = { inviteId: "invite-1", url: "https://example.com/invite", sent: true }

        await expect(service.succeed("command-1", result)).resolves.toBeUndefined()

        expect(em.update.mock.calls).toEqual([
            [AppCommandEntity, OPEN, { state: "done", result, errorCode: null, finishedAt: SQL_EXPRESSION }],
        ])
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
        const { em } = beginning([])
        const error = new Error("begin unavailable")
        em.createQueryBuilder.mockReturnValue(fakeQueryBuilder({ execute: () => Promise.reject(error) }).builder)
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
