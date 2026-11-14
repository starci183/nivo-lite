import { Test } from "@nestjs/testing"
import { mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { IsNull } from "typeorm"
import { WorkspaceEntity, WorkspacesErrorCode } from "@modules/domain/workspaces"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { workspaceRow } from "@tests/fixtures/builders/workspaces.builder"
import { WorkspaceSettingsService } from "./workspace-settings.service"

const build = async (entityManager: MockEntityManager) => {
    const moduleRef = await Test.createTestingModule({
        providers: [WorkspaceSettingsService, { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager }],
    }).compile()
    return moduleRef.get(WorkspaceSettingsService)
}

const LOGO = "https://files.example.test/avatars_public/workspaces/0b0a7a3a-1c1d-4e1f-8a2b-3c4d5e6f7a8b.png"

describe("WorkspaceSettingsService > get", () => {
    it("answers the name, the time zone and the logo of a living workspace", async () => {
        const row = workspaceRow({ name: "Spa Hoa Mai", timeZone: "Asia/Bangkok", logoUrl: LOGO })
        const em = mockEntityManager({ findOne: [WorkspaceEntity, row] })
        const service = await build(em)
        await expect(service.get("ws-1")).resolves.toEqual({
            name: "Spa Hoa Mai",
            timeZone: "Asia/Bangkok",
            logoUrl: LOGO,
        })
        expect(em.findOne).toHaveBeenCalledWith(WorkspaceEntity, {
            select: { id: true, name: true, timeZone: true, logoUrl: true },
            where: { id: "ws-1", deletedAt: IsNull() },
        })
    })

    it("answers the default zone and no logo for a workspace that set neither", async () => {
        const row = workspaceRow({ timeZone: "Mars/Olympus" })
        const service = await build(mockEntityManager({ findOne: [WorkspaceEntity, row] }))
        await expect(service.get("ws-1")).resolves.toMatchObject({ timeZone: "Asia/Ho_Chi_Minh", logoUrl: null })
    })

    it("refuses a workspace that is unknown or deleted", async () => {
        const service = await build(mockEntityManager({ findOne: [WorkspaceEntity, null] }))
        await expect(service.get("ws-1")).rejects.toMatchObject({ code: WorkspacesErrorCode.NotFound })
    })
})

describe("WorkspaceSettingsService > update", () => {
    it("writes only the members the change carries (the name trimmed) and answers the settings as they are now", async () => {
        const em = mockEntityManager({
            update: [WorkspaceEntity, { affected: 1 }],
            findOne: [WorkspaceEntity, workspaceRow({ name: "Spa Hoa Mai", timeZone: "Asia/Tokyo" })],
        })
        const service = await build(em)
        const saved = await service.update("ws-1", { name: "  Spa Hoa Mai ", timeZone: "Asia/Tokyo" })
        expect(em.update).toHaveBeenCalledWith(
            WorkspaceEntity,
            { id: "ws-1", deletedAt: IsNull() },
            { name: "Spa Hoa Mai", timeZone: "Asia/Tokyo" },
        )
        expect(saved).toMatchObject({ name: "Spa Hoa Mai", timeZone: "Asia/Tokyo" })
    })

    it("sets the logo address and removes it with null", async () => {
        const em = mockEntityManager({
            update: [WorkspaceEntity, { affected: 1 }],
            findOne: [WorkspaceEntity, workspaceRow()],
        })
        const service = await build(em)
        await service.update("ws-1", { logoUrl: null })
        expect(em.update).toHaveBeenLastCalledWith(WorkspaceEntity, expect.anything(), { logoUrl: null })
        await service.update("ws-1", { logoUrl: LOGO })
        expect(em.update).toHaveBeenLastCalledWith(WorkspaceEntity, expect.anything(), { logoUrl: LOGO })
    })

    it("writes nothing for an empty change", async () => {
        const em = mockEntityManager({ findOne: [WorkspaceEntity, workspaceRow()] })
        const service = await build(em)
        await service.update("ws-1", {})
        expect(em.update).not.toHaveBeenCalled()
    })

    it.each([" ", "x".repeat(121)])("refuses an empty or too long name before any write", async (name) => {
        const em = mockEntityManager()
        const service = await build(em)
        await expect(service.update("ws-1", { name })).rejects.toMatchObject({ code: WorkspacesErrorCode.NameInvalid })
        expect(em.update).not.toHaveBeenCalled()
    })

    it("refuses a time zone the platform does not know before any write", async () => {
        const em = mockEntityManager()
        const service = await build(em)
        await expect(service.update("ws-1", { timeZone: "Mars/Olympus" })).rejects.toMatchObject({
            code: WorkspacesErrorCode.TimeZoneInvalid,
        })
        expect(em.update).not.toHaveBeenCalled()
    })

    it("refuses a workspace that is unknown or deleted", async () => {
        const service = await build(mockEntityManager({ update: [WorkspaceEntity, { affected: 0 }] }))
        await expect(service.update("ws-1", { name: "A" })).rejects.toMatchObject({
            code: WorkspacesErrorCode.NotFound,
        })
    })
})

const THEME = { hue: 250, chroma: 0.2, lightness: 0.6, base: 0.4, font: "lexend", radius: "large", mode: null }

describe("WorkspaceSettingsService > theme", () => {
    it("answers null while the workspace wears the NIVO default", async () => {
        const service = await build(mockEntityManager({ findOne: [WorkspaceEntity, workspaceRow()] }))
        await expect(service.getTheme("ws-1")).resolves.toBeNull()
    })

    it("answers the stored theme, and null for a stored value that no longer passes the policy", async () => {
        const stored = await build(mockEntityManager({ findOne: [WorkspaceEntity, workspaceRow({ theme: THEME })] }))
        await expect(stored.getTheme("ws-1")).resolves.toEqual(THEME)
        const stale = await build(
            mockEntityManager({ findOne: [WorkspaceEntity, workspaceRow({ theme: { ...THEME, font: "gone" } })] }),
        )
        await expect(stale.getTheme("ws-1")).resolves.toBeNull()
    })

    it("saves a valid theme as the parameters only", async () => {
        const em = mockEntityManager({ update: [WorkspaceEntity, { affected: 1 }] })
        const service = await build(em)
        await expect(service.setTheme("ws-1", { ...THEME, extra: "x" })).resolves.toEqual(THEME)
        expect(em.update).toHaveBeenCalledWith(WorkspaceEntity, { id: "ws-1", deletedAt: IsNull() }, { theme: THEME })
    })

    it("returns to the NIVO default when given null", async () => {
        const em = mockEntityManager({ update: [WorkspaceEntity, { affected: 1 }] })
        const service = await build(em)
        await expect(service.setTheme("ws-1", null)).resolves.toBeNull()
        expect(em.update).toHaveBeenCalledWith(WorkspaceEntity, { id: "ws-1", deletedAt: IsNull() }, { theme: null })
    })

    it("refuses a theme out of range before any write, and a workspace that is unknown", async () => {
        const em = mockEntityManager()
        const service = await build(em)
        await expect(service.setTheme("ws-1", { ...THEME, hue: 400 })).rejects.toMatchObject({
            code: WorkspacesErrorCode.ThemeInvalid,
        })
        expect(em.update).not.toHaveBeenCalled()
        const gone = await build(mockEntityManager({ update: [WorkspaceEntity, { affected: 0 }] }))
        await expect(gone.setTheme("ws-1", THEME)).rejects.toMatchObject({ code: WorkspacesErrorCode.NotFound })
    })
})
