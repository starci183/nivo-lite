import { Test } from "@nestjs/testing"
import { mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { AppCommandsService } from "./app-commands.service"
import type { AppCommandRow } from "./persistence/app-commands.rows"
import { BEGIN_COMMAND, FAIL_COMMAND, SUCCEED_COMMAND } from "./persistence/app-commands.sql"

const row: AppCommandRow = {
    id: "command-1",
    workspace_id: "workspace-1",
    requested_by: "person-1",
    kind: "invite.create",
    input: { email: "invitee@example.com", role: "member" },
}

async function serviceOf(em: MockEntityManager): Promise<AppCommandsService> {
    const moduleRef = await Test.createTestingModule({
        providers: [AppCommandsService, { provide: PRIMARY_ENTITY_MANAGER, useValue: em }],
    }).compile()
    return moduleRef.get(AppCommandsService)
}

describe("AppCommandsService", () => {
    it("begins the command and maps its persisted columns", async () => {
        const em = mockEntityManager({ query: [BEGIN_COMMAND, [row]] })
        const service = await serviceOf(em)

        await expect(service.begin("command-1")).resolves.toEqual({
            id: "command-1",
            workspaceId: "workspace-1",
            requestedBy: "person-1",
            kind: "invite.create",
            input: { email: "invitee@example.com", role: "member" },
        })
        expect(em.query.mock.calls).toEqual([[BEGIN_COMMAND, ["command-1"]]])
    })

    it("preserves a command without a workspace and with an empty record", async () => {
        const em = mockEntityManager({ query: [BEGIN_COMMAND, [{ ...row, workspace_id: null, input: {} }]] })
        const service = await serviceOf(em)

        await expect(service.begin("command-1")).resolves.toEqual({
            id: "command-1",
            workspaceId: null,
            requestedBy: "person-1",
            kind: "invite.create",
            input: {},
        })
        expect(em.query.mock.calls).toEqual([[BEGIN_COMMAND, ["command-1"]]])
    })

    it.each([
        { input: null },
        { input: undefined },
        { input: [] },
        { input: ["email"] },
        { input: "email" },
        { input: 12 },
        { input: false },
    ])("uses an empty input for persisted $input", async ({ input }) => {
        const em = mockEntityManager({ query: [BEGIN_COMMAND, [{ ...row, input }]] })
        const service = await serviceOf(em)

        await expect(service.begin("command-1")).resolves.toEqual({
            id: "command-1",
            workspaceId: "workspace-1",
            requestedBy: "person-1",
            kind: "invite.create",
            input: {},
        })
        expect(em.query.mock.calls).toEqual([[BEGIN_COMMAND, ["command-1"]]])
    })

    it.each(["unknown-command", "settled-command"])("returns null when %s has no eligible row", async (commandId) => {
        const em = mockEntityManager({ query: [BEGIN_COMMAND, []] })
        const service = await serviceOf(em)

        await expect(service.begin(commandId)).resolves.toBeNull()

        expect(em.query.mock.calls).toEqual([[BEGIN_COMMAND, [commandId]]])
    })

    it("settles a successful command with its JSON result", async () => {
        const em = mockEntityManager({ query: [SUCCEED_COMMAND, [{ id: "command-1" }]] })
        const service = await serviceOf(em)

        await expect(
            service.succeed("command-1", { inviteId: "invite-1", url: "https://example.com/invite", sent: true }),
        ).resolves.toBeUndefined()

        expect(em.query.mock.calls).toEqual([
            [SUCCEED_COMMAND, ["command-1", '{"inviteId":"invite-1","url":"https://example.com/invite","sent":true}']],
        ])
    })

    it("settles a failed command with the exact domain code", async () => {
        const em = mockEntityManager({ query: [FAIL_COMMAND, [{ id: "command-1" }]] })
        const service = await serviceOf(em)

        await expect(service.fail("command-1", "INVITE_EXPIRED")).resolves.toBeUndefined()

        expect(em.query.mock.calls).toEqual([[FAIL_COMMAND, ["command-1", "INVITE_EXPIRED"]]])
    })

    it("rethrows a begin query failure", async () => {
        const em = mockEntityManager({ query: [BEGIN_COMMAND, []] })
        const error = new Error("begin unavailable")
        em.query.mockRejectedValueOnce(error)
        const service = await serviceOf(em)

        await expect(service.begin("command-1")).rejects.toBe(error)

        expect(em.query.mock.calls).toEqual([[BEGIN_COMMAND, ["command-1"]]])
    })

    it("rethrows a success query failure", async () => {
        const em = mockEntityManager({ query: [SUCCEED_COMMAND, []] })
        const error = new Error("success unavailable")
        em.query.mockRejectedValueOnce(error)
        const service = await serviceOf(em)

        await expect(service.succeed("command-1", {})).rejects.toBe(error)

        expect(em.query.mock.calls).toEqual([[SUCCEED_COMMAND, ["command-1", "{}"]]])
    })

    it("rethrows an error while recording failure", async () => {
        const em = mockEntityManager({ query: [FAIL_COMMAND, []] })
        const error = new Error("failure unavailable")
        em.query.mockRejectedValueOnce(error)
        const service = await serviceOf(em)

        await expect(service.fail("command-1", "INVITE_EXPIRED")).rejects.toBe(error)

        expect(em.query.mock.calls).toEqual([[FAIL_COMMAND, ["command-1", "INVITE_EXPIRED"]]])
    })
})
