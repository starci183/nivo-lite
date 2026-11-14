import { Test } from "@nestjs/testing"
import { FakeClock, mock } from "@starci/jest-preset"
import { z } from "zod"
import { defineRead } from "@nivo-lite/agent-sdk/block"
import type { ActionDefinition, ActionResult, ReadDefinition } from "@nivo-lite/agent-sdk/block"
import { defineEntity, field } from "@nivo-lite/agent-sdk/entity"
import { entityPort } from "@nivo-lite/agent-sdk/entity/port"
import type { ModuleDeclaration } from "@nivo-lite/agent-sdk/module"
import { EntityEngineService, ModuleAgentService } from "@modules/domain/entity-engine"
import { InstallationRecordsService } from "@modules/domain/module-installations"
import { RecordFilesService } from "@modules/domain/record-files"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import type { WorkspaceRole } from "@modules/domain/workspace-members"
import { WorkspaceTimeZoneService } from "@modules/domain/workspace-settings"
import { CLOCK } from "@modules/platform/clock"
import { MESSAGE_CATALOG } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { parseJsonText } from "@modules/platform/primitives"
import { fileGrantOf } from "./door-files.policy"
import { DoorPortsService } from "./door-ports.service"
import { DoorProviderReadsService } from "./door-provider-reads.service"
import { registryOf } from "./door-registry.policy"
import { WorkbenchDoorErrorCode } from "./errors/workbench-door.error"
import { WORKBENCH_DOOR_OPTIONS } from "./workbench-door.decorators"
import type { DoorAnswer, DoorFileCall } from "./workbench-door.contracts"
import { WorkbenchDoorService } from "./workbench-door.service"

/** A module's record type with a file field, and one it does not reach from the action. */
const PROJECT = defineEntity({
    name: "fixture.project",
    dataKind: "fixture-project",
    fields: { title: field.text({ maxLength: 40 }), cover: field.file({ accept: ["image/*"], maxBytes: 1000 }) },
})
const SECRET = defineEntity({
    name: "fixture.secret",
    dataKind: "fixture-secret",
    fields: { scan: field.file({ accept: ["image/*"], maxBytes: 1000 }) },
})

const OK: ActionResult = { ok: true }

const SAVE: ActionDefinition = {
    entry: "action",
    id: "fixture.project-save",
    operation: "fixture.project-save",
    permission: "fixture.manage",
    label: { key: "fixture.save" },
    ports: { projects: entityPort(PROJECT) },
    execute: () => Promise.resolve(OK),
}

/** The same reach, declared with the staff mark. */
const ATTACH: ActionDefinition = { ...SAVE, id: "fixture.project-attach", operation: "fixture.project-attach", staff: true }

const VIEW: ReadDefinition = defineRead({
    id: "fixture.project",
    dataKind: PROJECT.dataKind,
    shape: "record",
    fields: ["id", "title", "cover"],
    paths: {},
    variables: z.object({}),
    permission: "fixture.view",
    ports: { projects: entityPort(PROJECT) },
    run: () => Promise.resolve(null),
})

const MODULE: ModuleDeclaration = {
    entry: "module",
    key: "fixture",
    namespace: "fixture",
    permissions: ["fixture.view", "fixture.manage"],
    reads: [VIEW],
    actions: [SAVE, ATTACH],
    specs: [],
}

const WORKSPACE = "11111111-1111-4111-8111-111111111111"
const RECORD = "0b9f1c2e-6d1a-4f0e-9a37-000000000001"
const USER = "user-1"

const callOf = (patch: Partial<DoorFileCall> = {}): DoorFileCall => ({
    workspaceId: WORKSPACE,
    via: SAVE.id,
    type: PROJECT.name,
    recordId: RECORD,
    field: "cover",
    ...patch,
})

type RecordFileTicket = Awaited<ReturnType<RecordFilesService["upload"]>>
type RecordFileUrl = Awaited<ReturnType<RecordFilesService["url"]>>

const TICKET: RecordFileTicket = { key: "k", url: "https://s/u", method: "PUT", headers: {}, expiresAt: "2026-11-13T00:15:00.000Z" }
const URL_OF: RecordFileUrl = { url: "https://s/g", expiresAt: "2026-11-13T01:00:00.000Z", name: "a.png", mime: "image/png", size: 4 }

const REF = { key: "k", mime: "image/png", size: 4, name: "a.png" }

const build = async ({ role = "staff", files = true }: { readonly role?: WorkspaceRole; readonly files?: boolean } = {}) => {
    const members = mock<WorkspaceMembersService>()
    members.require.mockResolvedValue({
        userId: USER,
        workspaceId: WORKSPACE,
        role,
        staffId: null,
        displayName: "An",
        status: "active",
    })
    members.idOf.mockResolvedValue("member-1")
    const recordFiles = mock<RecordFilesService>()
    recordFiles.upload.mockResolvedValue(TICKET)
    recordFiles.confirm.mockResolvedValue({ key: "k", mime: "image/png", size: 4, name: "a.png" })
    recordFiles.link.mockResolvedValue(REF)
    recordFiles.url.mockResolvedValue(URL_OF)
    recordFiles.delete.mockResolvedValue({ removed: true })
    const moduleRef = await Test.createTestingModule({
        providers: [
            WorkbenchDoorService,
            { provide: WORKBENCH_DOOR_OPTIONS, useValue: { modules: [MODULE], entities: [PROJECT, SECRET], registryHash: "h" } },
            { provide: CLOCK, useValue: new FakeClock("2026-11-13T00:00:00.000Z") },
            { provide: MESSAGE_CATALOG, useValue: mock<MessageCatalog>() },
            { provide: LOGGER, useValue: mock<Logger>() },
            { provide: WorkspaceMembersService, useValue: members },
            { provide: EntityEngineService, useValue: mock<EntityEngineService>() },
            { provide: DoorPortsService, useValue: mock<DoorPortsService>() },
            DoorProviderReadsService,
            { provide: WorkspaceTimeZoneService, useValue: mock<WorkspaceTimeZoneService>() },
            { provide: InstallationRecordsService, useValue: mock<InstallationRecordsService>() },
            { provide: ModuleAgentService, useValue: mock<ModuleAgentService>() },
            ...(files ? [{ provide: RecordFilesService, useValue: recordFiles }] : []),
        ],
    }).compile()
    return { door: moduleRef.get(WorkbenchDoorService), members, recordFiles }
}

const parsed = (answer: DoorAnswer): unknown => {
    const read = parseJsonText(answer.data)
    return read.ok ? read.value : undefined
}

describe("fileGrantOf", () => {
    const registry = registryOf([MODULE], [PROJECT, SECRET])

    it("grants upload, link and delete by an action that reaches the type, and a url by a read or an action that does", () => {
        for (const verb of ["upload", "link", "delete"] as const) {
            expect(fileGrantOf(registry, SAVE.id, PROJECT.name, verb)).toEqual({ permission: "fixture.manage", staff: false })
            expect(fileGrantOf(registry, ATTACH.id, PROJECT.name, verb)).toEqual({ permission: "fixture.manage", staff: true })
        }
        expect(fileGrantOf(registry, VIEW.id, PROJECT.name, "url")).toEqual({ permission: "fixture.view", staff: true })
    })

    it("lets every member read a file's address, by a read or by an action: viewing is not an action", () => {
        expect(fileGrantOf(registry, SAVE.id, PROJECT.name, "url").staff).toBe(true)
    })

    it("refuses a write verb by a read, a via the door does not serve, and a type the via does not reach", () => {
        for (const verb of ["upload", "link", "delete"] as const) {
            expect(() => fileGrantOf(registry, VIEW.id, PROJECT.name, verb)).toThrow(WorkbenchDoorErrorCode.ActionUnknown)
        }
        expect(() => fileGrantOf(registry, "fixture.ghost", PROJECT.name, "url")).toThrow(WorkbenchDoorErrorCode.ReadUnknown)
        for (const verb of ["upload", "link", "delete", "url"] as const) {
            expect(() => fileGrantOf(registry, SAVE.id, SECRET.name, verb)).toThrow(WorkbenchDoorErrorCode.FileNotDeclared)
        }
    })
})

describe("WorkbenchDoorService: the files of records", () => {
    it("issues a ticket, confirms, links, reads and deletes for a manager, in the proven workspace", async () => {
        const { door, recordFiles } = await build({ role: "manager" })

        expect(parsed(await door.fileUpload(USER, callOf(), { name: "a.png", mime: "image/png", size: 4 }))).toEqual(TICKET)
        expect(recordFiles.upload).toHaveBeenCalledWith(
            WORKSPACE,
            { type: PROJECT.name, recordId: RECORD, field: "cover" },
            { name: "a.png", mime: "image/png", size: 4 },
        )
        expect(parsed(await door.fileConfirm(USER, callOf(), "k", "a.png"))).toEqual({
            key: "k",
            mime: "image/png",
            size: 4,
            name: "a.png",
        })
        expect(parsed(await door.fileLink(USER, callOf(), "k", "a.png"))).toEqual(REF)
        expect(recordFiles.link).toHaveBeenCalledWith(WORKSPACE, { type: PROJECT.name, recordId: RECORD, field: "cover" }, { key: "k", name: "a.png" })
        expect(parsed(await door.fileUrl(USER, callOf()))).toEqual(URL_OF)
        expect(parsed(await door.fileDelete(USER, callOf()))).toEqual({ removed: true })
        expect(recordFiles.delete).toHaveBeenCalledWith(WORKSPACE, { type: PROJECT.name, recordId: RECORD, field: "cover" })
    })

    it("carries the object key of one file of a list field into the target of a url or a delete, and none for a single field", async () => {
        const { door, recordFiles } = await build({ role: "manager" })
        const item = callOf({ key: "ws/fixture.project/r/cover/o1" })
        await door.fileUrl(USER, item)
        await door.fileDelete(USER, item)
        const target = { type: PROJECT.name, recordId: RECORD, field: "cover", key: "ws/fixture.project/r/cover/o1" }
        expect(recordFiles.url).toHaveBeenCalledWith(WORKSPACE, target)
        expect(recordFiles.delete).toHaveBeenCalledWith(WORKSPACE, target)
        await door.fileUrl(USER, callOf())
        expect(recordFiles.url).toHaveBeenLastCalledWith(WORKSPACE, { type: PROJECT.name, recordId: RECORD, field: "cover" })
    })

    it("lets a manager through, lets a staff member read, and refuses a staff member a write by an action without the staff mark", async () => {
        const manager = await build({ role: "manager" })
        await manager.door.fileUrl(USER, callOf({ via: VIEW.id }))
        expect(manager.recordFiles.url).toHaveBeenCalled()

        const staff = await build()
        await staff.door.fileUrl(USER, callOf())
        expect(staff.recordFiles.url).toHaveBeenCalled()
        await expect(staff.door.fileUpload(USER, callOf(), { name: "a", mime: "image/png", size: 1 })).rejects.toThrow(
            WorkbenchDoorErrorCode.PermissionDenied,
        )
        await expect(staff.door.fileLink(USER, callOf(), "k", "a")).rejects.toThrow(WorkbenchDoorErrorCode.PermissionDenied)
        await expect(staff.door.fileDelete(USER, callOf())).rejects.toThrow(WorkbenchDoorErrorCode.PermissionDenied)
        expect(staff.recordFiles.upload).not.toHaveBeenCalled()
        expect(staff.recordFiles.link).not.toHaveBeenCalled()
        expect(staff.recordFiles.delete).not.toHaveBeenCalled()
    })

    it("lets a staff member write the files by an action that declares the staff mark", async () => {
        const { door, recordFiles } = await build({ role: "staff" })
        const marked = callOf({ via: ATTACH.id })

        await door.fileUpload(USER, marked, { name: "a.png", mime: "image/png", size: 4 })
        await door.fileLink(USER, marked, "k", "a.png")
        await door.fileDelete(USER, marked)

        expect(recordFiles.upload).toHaveBeenCalledTimes(1)
        expect(recordFiles.link).toHaveBeenCalledTimes(1)
        expect(recordFiles.delete).toHaveBeenCalledTimes(1)
    })

    it("refuses a non-member before anything else", async () => {
        const { door, members, recordFiles } = await build({ role: "manager" })
        members.require.mockRejectedValue(new Error("not a member"))

        await expect(door.fileUrl(USER, callOf())).rejects.toThrow("not a member")
        await expect(door.fileDelete(USER, callOf())).rejects.toThrow("not a member")
        expect(recordFiles.url).not.toHaveBeenCalled()
        expect(recordFiles.delete).not.toHaveBeenCalled()
    })

    it("refuses a record type the via does not reach, so a screen gets no other module's files", async () => {
        const { door, recordFiles } = await build({ role: "manager" })

        const other = callOf({ type: SECRET.name, field: "scan" })
        await expect(door.fileUrl(USER, other)).rejects.toThrow(WorkbenchDoorErrorCode.FileNotDeclared)
        await expect(door.fileLink(USER, other, "k", "a")).rejects.toThrow(WorkbenchDoorErrorCode.FileNotDeclared)
        await expect(door.fileDelete(USER, other)).rejects.toThrow(WorkbenchDoorErrorCode.FileNotDeclared)
        expect(recordFiles.url).not.toHaveBeenCalled()
        expect(recordFiles.link).not.toHaveBeenCalled()
        expect(recordFiles.delete).not.toHaveBeenCalled()
    })

    it("says the file store is not provided in an app that binds none", async () => {
        const { door } = await build({ role: "manager", files: false })

        await expect(door.fileUrl(USER, callOf())).rejects.toThrow(WorkbenchDoorErrorCode.PortUnprovided)
    })
})
