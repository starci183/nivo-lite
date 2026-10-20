import { Test } from "@nestjs/testing"
import { mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { ContentSettingsService } from "./content-settings.service"
import {
    MERGE_MARKS,
    SAVE_GUIDELINE_BRAND,
    SELECT_GUIDELINE_BRAND,
    SELECT_TICK_WORKSPACES,
} from "./persistence/content-settings.sql"

const build = async (entityManager: MockEntityManager) => {
    const moduleRef = await Test.createTestingModule({
        providers: [ContentSettingsService, { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager }],
    }).compile()
    return moduleRef.get(ContentSettingsService)
}

describe("ContentSettingsService", () => {
    describe("tickWorkspaces", () => {
        it("answers the next page of workspaces with an automation on", async () => {
            const em = mockEntityManager({
                query: [
                    SELECT_TICK_WORKSPACES,
                    [
                        {
                            workspace_id: "workspace-1",
                            automations: { today_reminder: true },
                            marks: { reminder_day: "2026-10-11" },
                        },
                    ],
                ],
            })
            const settings = await build(em)

            await expect(settings.tickWorkspaces("after-id", 200)).resolves.toEqual([
                {
                    workspaceId: "workspace-1",
                    automations: { today_reminder: true },
                    marks: { reminder_day: "2026-10-11" },
                },
            ])
            expect(em.query).toHaveBeenCalledWith(SELECT_TICK_WORKSPACES, [null, "after-id", 200])
        })

        it("limits the scan to the one workspace it is given", async () => {
            const em = mockEntityManager({ query: [SELECT_TICK_WORKSPACES, []] })

            await expect((await build(em)).tickWorkspaces("after-id", 200, "workspace-1")).resolves.toEqual([])
            expect(em.query).toHaveBeenCalledWith(SELECT_TICK_WORKSPACES, ["workspace-1", "after-id", 200])
        })
    })

    describe("mergeMarks", () => {
        it("merges the marks into the settings of the workspace", async () => {
            const em = mockEntityManager({ query: [MERGE_MARKS, []] })

            await (await build(em)).mergeMarks("workspace-1", { summary_week: "2026-10-12" })

            expect(em.query).toHaveBeenCalledWith(MERGE_MARKS, ["workspace-1", '{"summary_week":"2026-10-12"}'])
        })
    })
})

describe("ContentSettingsService (continued)", () => {
    describe("guideline brand", () => {
        it("writes the confirmed brand", async () => {
            const em = mockEntityManager({ query: [SAVE_GUIDELINE_BRAND, []] })
            const settings = await build(em)

            await settings.saveGuidelineBrand("workspace-1", {
                colors: [{ name: "Gold", hex: "#c2996b" }],
                fonts: ["F"],
                tone: "Warm",
                imagery: ["spa"],
                source: "guide.pdf",
                voice: "Warm voice",
                avoid: "cheap",
            })

            expect(em.query).toHaveBeenCalledWith(SAVE_GUIDELINE_BRAND, [
                "workspace-1",
                '[{"name":"Gold","hex":"#c2996b"}]',
                ["F"],
                "Warm",
                ["spa"],
                "guide.pdf",
                "Warm voice",
                "cheap",
            ])
        })

        it("reads the stored brand, or null without settings", async () => {
            const em = mockEntityManager({
                query: [
                    [
                        SELECT_GUIDELINE_BRAND,
                        [{ brand_colors: [], brand_fonts: ["F"], brand_tone: "Warm", brand_imagery: [], avoid: "" }],
                    ],
                    [SELECT_GUIDELINE_BRAND, []],
                ],
            })
            const settings = await build(em)

            await expect(settings.guidelineBrandOf("workspace-1")).resolves.toEqual({
                colors: [],
                fonts: ["F"],
                tone: "Warm",
                imagery: [],
                avoid: "",
            })
            await expect(settings.guidelineBrandOf("workspace-1")).resolves.toBeNull()
        })
    })
})
