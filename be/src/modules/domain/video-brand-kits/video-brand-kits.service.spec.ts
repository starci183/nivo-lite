import { Test } from "@nestjs/testing"
import { mockEntityManager } from "@starci/jest-preset"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { SAVE_GUIDELINE_COLORS, SAVE_WORKBENCH_BRAND, SELECT_KIT_LOGO } from "./persistence/video-brand-kits.sql"
import { VideoBrandKitsService } from "./video-brand-kits.service"

const build = async () => {
    const em = mockEntityManager({ query: [SAVE_WORKBENCH_BRAND, [{ workspace_id: "workspace-1" }]] })
    const moduleRef = await Test.createTestingModule({
        providers: [VideoBrandKitsService, { provide: PRIMARY_ENTITY_MANAGER, useValue: em }],
    }).compile()
    return { service: moduleRef.get(VideoBrandKitsService), em }
}

describe("VideoBrandKitsService", () => {
    describe("save", () => {
        it("upserts the kit of the workspace with the manager as its last editor", async () => {
            const { service, em } = await build()

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

            expect(em.query).toHaveBeenCalledWith(SAVE_WORKBENCH_BRAND, [
                "workspace-1",
                "Bakery",
                "#16a34a",
                "#0f172a",
                "workspace-1/logo.png",
                "calm-glow",
                "vi-VN-HoaiMyNeural",
                "person-1",
            ])
        })

        it("passes missing colors as null so the stored defaults stay", async () => {
            const { service, em } = await build()

            await service.save("workspace-1", "person-1", {
                shopName: "Bakery",
                primary: null,
                secondary: null,
                logoPath: null,
                musicTrack: null,
                voice: "vi-VN-NamMinhNeural",
            })

            expect(em.query.mock.calls[0]?.[1]).toEqual([
                "workspace-1",
                "Bakery",
                null,
                null,
                null,
                null,
                "vi-VN-NamMinhNeural",
                "person-1",
            ])
        })
    })
})

describe("VideoBrandKitsService (continued)", () => {
    describe("guideline brand", () => {
        it("writes the guideline colors and the bounded name", async () => {
            const em = mockEntityManager({ query: [SAVE_GUIDELINE_COLORS, []] })
            const moduleRef = await Test.createTestingModule({
                providers: [VideoBrandKitsService, { provide: PRIMARY_ENTITY_MANAGER, useValue: em }],
            }).compile()

            await moduleRef.get(VideoBrandKitsService).saveGuidelineColors("workspace-1", "person-1", {
                primary: "#c2996b",
                secondary: "#5a4632",
                shopName: "H".repeat(70),
            })

            expect(em.query).toHaveBeenCalledWith(SAVE_GUIDELINE_COLORS, [
                "workspace-1",
                "#c2996b",
                "#5a4632",
                "H".repeat(60),
                "person-1",
            ])
        })

        it("answers the logo and name, empty without a kit", async () => {
            const em = mockEntityManager({
                query: [
                    [SELECT_KIT_LOGO, [{ logo_path: "workspace-1/logo.png", shop_name: "HAKUEN" }]],
                    [SELECT_KIT_LOGO, []],
                ],
            })
            const moduleRef = await Test.createTestingModule({
                providers: [VideoBrandKitsService, { provide: PRIMARY_ENTITY_MANAGER, useValue: em }],
            }).compile()
            const service = moduleRef.get(VideoBrandKitsService)

            await expect(service.identityOf("workspace-1")).resolves.toEqual({
                logoPath: "workspace-1/logo.png",
                shopName: "HAKUEN",
            })
            await expect(service.identityOf("workspace-1")).resolves.toEqual({ logoPath: null, shopName: "" })
        })
    })
})
