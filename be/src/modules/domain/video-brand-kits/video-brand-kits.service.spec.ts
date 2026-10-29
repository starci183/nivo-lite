import { Test } from "@nestjs/testing"
import { mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { fakeQueryBuilder } from "@tests/fixtures/builders/entity-query-builder-fake.builder"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { VideoBrandKitEntity } from "./persistence/entities"
import { VideoBrandKitsService } from "./video-brand-kits.service"

const build = async (em: MockEntityManager = mockEntityManager()) => {
    const write = fakeQueryBuilder({ execute: { raw: [] } })
    em.createQueryBuilder.mockReturnValue(write.builder as never)
    const moduleRef = await Test.createTestingModule({
        providers: [VideoBrandKitsService, { provide: PRIMARY_ENTITY_MANAGER, useValue: em }],
    }).compile()
    return { service: moduleRef.get(VideoBrandKitsService), em, write }
}

describe("VideoBrandKitsService", () => {
    describe("save", () => {
        it("upserts the kit of the workspace with the manager as its last editor", async () => {
            const { service, em: manager, write } = await build()

            await expect(
                service.save("workspace-1", "person-1", {
                    shopName: "Bakery",
                    primary: "#16a34a",
                    secondary: "#0f172a",
                    logoPath: "workspace-1/logo.png",
                    musicTrack: "calm-glow",
                    voice: "vi-VN-HoaiMyNeural",
                }),
            ).resolves.toBeUndefined()

            expect(manager.createQueryBuilder).toHaveBeenCalledWith(VideoBrandKitEntity, "v")

            expect(write.callsOf("insert")).toEqual([[]])
            expect(write.callsOf("values")).toEqual([
                [
                    {
                        workspaceId: "workspace-1",
                        shopName: "Bakery",
                        primaryColor: "#16a34a",
                        secondaryColor: "#0f172a",
                        logoPath: "workspace-1/logo.png",
                        musicTrack: "calm-glow",
                        voice: "vi-VN-HoaiMyNeural",
                        updatedBy: "person-1",
                    },
                ],
            ])
            expect(write.callsOf("orUpdate")).toEqual([
                [
                    [
                        "shop_name",
                        "primary_color",
                        "secondary_color",
                        "logo_path",
                        "music_track",
                        "voice",
                        "updated_by",
                    ],
                    ["workspace_id"],
                ],
            ])
        })

        it("leaves missing colors out so the stored values and defaults stay", async () => {
            const { service, write } = await build()

            await service.save("workspace-1", "person-1", {
                shopName: "Bakery",
                primary: null,
                secondary: null,
                logoPath: null,
                musicTrack: null,
                voice: "vi-VN-NamMinhNeural",
            })

            expect(write.callsOf("values")).toEqual([
                [
                    {
                        workspaceId: "workspace-1",
                        shopName: "Bakery",
                        logoPath: null,
                        musicTrack: null,
                        voice: "vi-VN-NamMinhNeural",
                        updatedBy: "person-1",
                    },
                ],
            ])
            expect(write.callsOf("orUpdate")).toEqual([
                [["shop_name", "logo_path", "music_track", "voice", "updated_by"], ["workspace_id"]],
            ])
        })
    })
})

describe("VideoBrandKitsService (continued)", () => {
    describe("guideline brand", () => {
        it("writes the guideline colors and the bounded name", async () => {
            const { service, write } = await build()

            await service.saveGuidelineColors("workspace-1", "person-1", {
                primary: "#c2996b",
                secondary: "#5a4632",
                shopName: "H".repeat(70),
            })

            expect(write.callsOf("values")).toEqual([
                [
                    {
                        workspaceId: "workspace-1",
                        primaryColor: "#c2996b",
                        secondaryColor: "#5a4632",
                        shopName: "H".repeat(60),
                        updatedBy: "person-1",
                        updatedAt: expect.any(Function),
                    },
                ],
            ])
            expect(write.callsOf("orUpdate")).toEqual([
                [["primary_color", "secondary_color", "shop_name", "updated_by", "updated_at"], ["workspace_id"]],
            ])
            const values = write.callsOf("values")[0]?.[0] as { updatedAt: () => string } | undefined
            expect(values?.updatedAt()).toBe("now()")
        })

        it("keeps the stored name when the brand has none", async () => {
            const { service, write } = await build()

            await service.saveGuidelineColors("workspace-1", "person-1", {
                primary: "#c2996b",
                secondary: "#5a4632",
                shopName: "",
            })

            expect(write.callsOf("orUpdate")).toEqual([
                [["primary_color", "secondary_color", "updated_by", "updated_at"], ["workspace_id"]],
            ])
        })

        it("answers the logo and name, empty without a kit", async () => {
            const kit = Object.assign(new VideoBrandKitEntity(), {
                logoPath: "workspace-1/logo.png",
                shopName: "HAKUEN",
            })
            const { service, em } = await build(
                mockEntityManager({
                    findOne: [
                        [VideoBrandKitEntity, kit],
                        [VideoBrandKitEntity, null],
                    ],
                }),
            )

            await expect(service.identityOf("workspace-1")).resolves.toEqual({
                logoPath: "workspace-1/logo.png",
                shopName: "HAKUEN",
            })
            await expect(service.identityOf("workspace-1")).resolves.toEqual({ logoPath: null, shopName: "" })
            expect(em.findOne).toHaveBeenCalledWith(VideoBrandKitEntity, {
                select: { logoPath: true, shopName: true },
                where: { workspaceId: "workspace-1" },
            })
        })
    })

    describe("kitOf", () => {
        it("answers the whole kit of the workspace, or null without one", async () => {
            const kit = Object.assign(new VideoBrandKitEntity(), {
                workspaceId: "workspace-1",
                shopName: "HAKUEN",
                primaryColor: "#112233",
                secondaryColor: "#445566",
                logoPath: "workspace-1/logo.png",
                musicTrack: "calm-glow",
                voice: "vi-VN-HoaiMyNeural",
            })
            const em = mockEntityManager({
                findOne: [
                    [VideoBrandKitEntity, kit],
                    [VideoBrandKitEntity, null],
                ],
            })
            const { service } = await build(em)

            await expect(service.kitOf("workspace-1")).resolves.toEqual({
                shopName: "HAKUEN",
                primaryColor: "#112233",
                secondaryColor: "#445566",
                logoPath: "workspace-1/logo.png",
                musicTrack: "calm-glow",
                voice: "vi-VN-HoaiMyNeural",
            })
            await expect(service.kitOf("workspace-2")).resolves.toBeNull()
            expect(em.findOne).toHaveBeenCalledWith(VideoBrandKitEntity, { where: { workspaceId: "workspace-1" } })
        })
    })
})
