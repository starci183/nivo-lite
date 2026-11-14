import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import type { ModuleContactBlock, ModuleDeclaration } from "@nivo-lite/agent-sdk/module"
import { AgentWorkAccessService } from "@modules/domain/agent-work"
import { ContactsError, ContactsErrorCode, ContactsService, type ContactWithIdentities } from "@modules/domain/contacts"
import { ModuleInstallService, type InstallationView } from "@modules/domain/modules"
import { CONTACT_BLOCK_ROWS_MAX } from "./contact-blocks.policy"
import { ContactBlocksService } from "./contact-blocks.service"
import { WorkbenchDoorError, WorkbenchDoorErrorCode } from "./errors/workbench-door.error"
import type { DoorCall } from "./workbench-door.contracts"
import { WORKBENCH_DOOR_OPTIONS } from "./workbench-door.decorators"
import { WorkbenchDoorService } from "./workbench-door.service"

const WORKSPACE = "11111111-1111-4111-8111-111111111111"
const CONTACT = "22222222-2222-4222-8222-222222222222"
const SALES_READ = "blocks-core.sales.api.order.of-contact"
const BOOKING_READ = "blocks-core.booking.api.slot.of-contact"

const blockOf = (read: `${string}.${string}`): ModuleContactBlock => ({
    id: "orders",
    title: { vi: "title-vi", en: "title-en" },
    read,
    block: { id: "core.record-list", slot: "rows", props: { label: "x" } },
})

/** A module declaration that holds only what the service reads: its key and its contact blocks. */
const moduleOf = (key: string, blocks: ReadonlyArray<ModuleContactBlock>): ModuleDeclaration =>
    Object.assign(mock<ModuleDeclaration>(), { key, contactBlocks: blocks })

const MODULES = [
    moduleOf("sales", [blockOf(SALES_READ)]),
    moduleOf("booking", [blockOf(BOOKING_READ)]),
    moduleOf("plain", []),
]

const installation = (id: string, moduleKey: string, agentName: string, status = "live"): InstallationView =>
    Object.assign(mock<InstallationView>(), { id, moduleKey, agentName, agentId: `agent-${id}`, status })

const rowsOf = (count: number, cursor: string | null = null): string =>
    JSON.stringify({ rows: Array.from({ length: count }, (_, at) => ({ id: `r${at}` })), cursor })

const denied = (): WorkbenchDoorError =>
    new WorkbenchDoorError({ code: WorkbenchDoorErrorCode.PermissionDenied, params: { permission: "booking.view" } })

const REQUEST = { workspaceId: WORKSPACE, contactId: CONTACT, locale: "vi" as const }

const build = async (installations: ReadonlyArray<InstallationView>) => {
    const access = mock<AgentWorkAccessService>()
    access.manager.mockResolvedValue("member-1")
    const contacts = mock<ContactsService>()
    contacts.get.mockImplementation((_workspace, id) =>
        Promise.resolve(id === CONTACT || id === "merged-away" ? Object.assign(mock<ContactWithIdentities>(), { id: CONTACT }) : null),
    )
    const installs = mock<ModuleInstallService>()
    installs.list.mockResolvedValue(installations)
    const door = mock<WorkbenchDoorService>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            ContactBlocksService,
            { provide: WORKBENCH_DOOR_OPTIONS, useValue: { modules: MODULES, entities: [], registryHash: "h" } },
            { provide: AgentWorkAccessService, useValue: access },
            { provide: ContactsService, useValue: contacts },
            { provide: ModuleInstallService, useValue: installs },
            { provide: WorkbenchDoorService, useValue: door },
        ],
    }).compile()
    return { service: moduleRef.get(ContactBlocksService), door, contacts }
}

describe("ContactBlocksService", () => {
    it("answers, per installed agent, the blocks its module declares with the rows the read gave for the contact, as the member", async () => {
        const { service, door } = await build([installation("i1", "sales", "agent-sales")])
        door.read.mockResolvedValue({ data: rowsOf(2) })

        const answer = await service.list("user-1", REQUEST)

        expect(answer).toMatchObject([
            {
                installationId: "i1",
                agentId: "agent-i1",
                agentName: "agent-sales",
                moduleKey: "sales",
                blocks: [{ id: "orders", title: "title-vi", count: 2, hasMore: false, dataJson: rowsOf(2) }],
            },
        ])
        const call: DoorCall = {
            workspaceId: WORKSPACE,
            name: SALES_READ,
            payload: JSON.stringify({ contactId: CONTACT }),
            locale: "vi",
            installationId: "i1",
        }
        expect(door.read).toHaveBeenCalledWith("user-1", call)
    })

    it("omits an agent whose read the member may not run, and lists the others", async () => {
        const { service, door } = await build([installation("i1", "sales", "agent-sales"), installation("i2", "booking", "agent-booking")])
        door.read.mockImplementation((_user, call) =>
            call.name === BOOKING_READ ? Promise.reject(denied()) : Promise.resolve({ data: rowsOf(1) }),
        )

        const answer = await service.list("user-1", REQUEST)

        expect(answer.map((agent) => agent.agentName)).toEqual(["agent-sales"])
    })

    it("lets any other failure of a read stop the answer, so a broken module is seen, not hidden", async () => {
        const { service, door } = await build([installation("i1", "sales", "agent-sales")])
        door.read.mockRejectedValue(new WorkbenchDoorError({ code: WorkbenchDoorErrorCode.PayloadInvalid, params: { issues: "." } }))

        await expect(service.list("user-1", REQUEST)).rejects.toMatchObject({ code: WorkbenchDoorErrorCode.PayloadInvalid })
    })

})

describe("ContactBlocksService rows and contacts", () => {
    it("keeps the block with an empty state when the contact has no rows, and bounds a long one", async () => {
        const { service, door } = await build([installation("i1", "sales", "agent-sales")])
        door.read.mockResolvedValueOnce({ data: rowsOf(0) })
        door.read.mockResolvedValueOnce({ data: rowsOf(CONTACT_BLOCK_ROWS_MAX + 3) })

        const [empty] = await service.list("user-1", REQUEST)
        const [long] = await service.list("user-1", REQUEST)

        expect(empty?.blocks[0]).toMatchObject({ count: 0, hasMore: false })
        expect(long?.blocks[0]).toMatchObject({ count: CONTACT_BLOCK_ROWS_MAX, hasMore: true })
    })

    it("skips an uninstalled agent and a module that declares no contact block, or none the installation knows", async () => {
        const { service, door } = await build([
            installation("i1", "sales", "agent-sales", "removed"),
            installation("i2", "plain", "agent-plain"),
            installation("i3", "unknown", "agent-unknown"),
        ])

        await expect(service.list("user-1", REQUEST)).resolves.toEqual([])
        expect(door.read).not.toHaveBeenCalled()
    })

    it("asks for the contact the workspace holds (the survivor of a merge) and refuses a contact of another workspace as not found", async () => {
        const { service, door, contacts } = await build([installation("i1", "sales", "agent-sales")])
        door.read.mockResolvedValue({ data: rowsOf(0) })

        await service.list("user-1", { ...REQUEST, contactId: "merged-away" })
        expect(door.read).toHaveBeenCalledWith("user-1", expect.objectContaining({ payload: JSON.stringify({ contactId: CONTACT }) }))

        door.read.mockClear()
        const error: unknown = await service
            .list("user-1", { ...REQUEST, contactId: "other-workspace" })
            .catch((cause: unknown) => cause)
        expect(error).toBeInstanceOf(ContactsError)
        expect(error).toMatchObject({ code: ContactsErrorCode.ContactMissing })
        expect(door.read).not.toHaveBeenCalled()
        expect(contacts.get).toHaveBeenLastCalledWith(WORKSPACE, "other-workspace")
    })
})
