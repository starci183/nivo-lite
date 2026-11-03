import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { OwnersService } from "@modules/domain/owners"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { WorkspacesService } from "@modules/domain/workspaces"
import { CHANNEL_PROVISIONING_OPTIONS } from "./channel-provisioning.decorators"
import { TEST_ACCOUNTS_SEED_SCHEMA } from "./test-accounts-seed.contracts"
import { TestAccountsSeedService } from "./test-accounts-seed.service"

const OWNER_PASSWORD = ["owner", "pass", "1"].join("-")
const STAFF_PASSWORD = ["staff", "pass", "1"].join("-")
const document = {
    schema: TEST_ACCOUNTS_SEED_SCHEMA,
    workspaces: [
        {
            name: "NIVO",
            seats: [
                { role: "owner", name: "Test owner", emailKey: "OWNER_EMAIL", passwordKey: "OWNER_PASSWORD" },
                { role: "staff", name: "Test staff", emailKey: "STAFF_EMAIL", passwordKey: "STAFF_PASSWORD" },
            ],
        },
    ],
    values: {
        OWNER_EMAIL: "owner@example.test",
        OWNER_PASSWORD,
        STAFF_EMAIL: "staff@example.test",
        STAFF_PASSWORD,
    },
}
const envelope = `${JSON.stringify({ documents: [{ path: "data/test-accounts.json", document }] })}\n`

const build = async () => {
    const owners = mock<OwnersService>()
    owners.createOwner.mockResolvedValue(undefined)
    owners.ensureAccount.mockImplementation((email) => Promise.resolve(`id-of-${email}`))
    const workspaces = mock<WorkspacesService>()
    workspaces.ensureNamed.mockResolvedValue({ id: "ws-1" })
    const members = mock<WorkspaceMembersService>()
    const print = jest.fn<void, [string]>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            TestAccountsSeedService,
            { provide: CHANNEL_PROVISIONING_OPTIONS, useValue: { print } },
            { provide: OwnersService, useValue: owners },
            { provide: WorkspacesService, useValue: workspaces },
            { provide: WorkspaceMembersService, useValue: members },
        ],
    }).compile()
    return { service: moduleRef.get(TestAccountsSeedService), owners, workspaces, members, print }
}

describe("TestAccountsSeedService", () => {
    it("sets the sealed passwords, ensures the workspace of the owner and adds the other seats, printing no value", async () => {
        const { service, owners, workspaces, members, print } = await build()

        await service.run(envelope)

        expect(owners.createOwner.mock.calls).toEqual([
            ["owner@example.test", OWNER_PASSWORD],
            ["staff@example.test", STAFF_PASSWORD],
        ])
        expect(workspaces.ensureNamed).toHaveBeenCalledWith("id-of-owner@example.test", "NIVO")
        expect(members.ensure).toHaveBeenCalledWith("id-of-owner@example.test", {
            workspaceId: "ws-1",
            userId: "id-of-staff@example.test",
            role: "staff",
            staffId: null,
            displayName: "Test staff",
        })
        expect(print.mock.calls.map(([line]) => line)).toEqual(["test workspace ws-1", "staff seat ready in ws-1"])
    })

    it("stops the run on a document that is refused, before any account is touched", async () => {
        const { service, owners } = await build()
        const refused = `${JSON.stringify({ documents: [{ document: { ...document, schema: "other" } }] })}\n`

        await expect(service.run(refused)).rejects.toThrow()

        expect(owners.createOwner).not.toHaveBeenCalled()
    })
})
