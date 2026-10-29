import { Test } from "@nestjs/testing"
import { mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { queueQueryBuilders } from "@tests/fixtures/builders/entity-query-builder.builder"
import { entityRowBuilder } from "@tests/fixtures/builders/entity-row.builder"
import { expressionValues } from "@tests/fixtures/builders/sql-expression.builder"
import { ContentSettingsService } from "./content-settings.service"
import { ContentSettingsEntity } from "./persistence/entities"

const settingsRow = entityRowBuilder<ContentSettingsEntity>({
    workspaceId: "workspace-1",
    brandVoice: "",
    avoid: "",
    cta: "",
    hashtags: [],
    automations: {},
    marks: {},
    updatedAt: new Date("2026-10-12T00:00:00.000Z"),
    brandColors: [],
    brandFonts: ["F"],
    brandTone: "Warm",
    brandImagery: [],
    brandSource: "",
})

const build = async (entityManager: MockEntityManager) => {
    const moduleRef = await Test.createTestingModule({
        providers: [ContentSettingsService, { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager }],
    }).compile()
    return moduleRef.get(ContentSettingsService)
}

describe("ContentSettingsService", () => {
    describe("tickWorkspaces", () => {
        it("answers the next page of workspaces with an automation on", async () => {
            const em = mockEntityManager()
            const [read] = queueQueryBuilders(em, [
                {
                    getMany: [
                        settingsRow({ automations: { today_reminder: true }, marks: { reminder_day: "2026-10-11" } }),
                    ],
                },
            ])
            const settings = await build(em)

            await expect(settings.tickWorkspaces("after-id", 200)).resolves.toEqual([
                {
                    workspaceId: "workspace-1",
                    automations: { today_reminder: true },
                    marks: { reminder_day: "2026-10-11" },
                },
            ])
            expect(read?.callsOf("setParameters")).toEqual([[{ only: null, after: "after-id" }]])
            expect(read?.callsOf("orderBy")).toEqual([["settings.workspaceId", "ASC"]])
            expect(read?.callsOf("limit")).toEqual([[200]])
        })

        it("limits the scan to the one workspace it is given", async () => {
            const em = mockEntityManager()
            const [read] = queueQueryBuilders(em, [{ getMany: [] }])

            await expect((await build(em)).tickWorkspaces("after-id", 200, "workspace-1")).resolves.toEqual([])
            expect(read?.callsOf("setParameters")).toEqual([[{ only: "workspace-1", after: "after-id" }]])
        })
    })

    describe("mergeMarks", () => {
        it("merges the marks into the settings of the workspace", async () => {
            const em = mockEntityManager()
            const [merge] = queueQueryBuilders(em, [{ execute: {} }])

            await (await build(em)).mergeMarks("workspace-1", { summary_week: "2026-10-12" })

            expect(em.createQueryBuilder).toHaveBeenCalledWith(ContentSettingsEntity, "cs")
            expect(expressionValues(merge?.callsOf("set")[0]?.[0])).toEqual({
                marks: "jsonb_concat(marks, CAST(:marks AS jsonb))",
            })
            expect(merge?.callsOf("where")).toEqual([[{ workspaceId: "workspace-1" }]])
            expect(merge?.callsOf("setParameter")).toEqual([["marks", '{"summary_week":"2026-10-12"}']])
        })
    })
})

describe("ContentSettingsService (continued)", () => {
    describe("guideline brand", () => {
        it("writes the confirmed brand", async () => {
            const em = mockEntityManager()
            const [save] = queueQueryBuilders(em, [{ execute: {} }])
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

            expect(save?.callsOf("values")).toMatchObject([
                [
                    {
                        workspaceId: "workspace-1",
                        brandFonts: ["F"],
                        brandTone: "Warm",
                        brandImagery: ["spa"],
                        brandSource: "guide.pdf",
                        brandVoice: "Warm voice",
                        avoid: "cheap",
                    },
                ],
            ])
            expect(expressionValues(save?.callsOf("values")[0]?.[0])).toMatchObject({ brandColors: ":colors::jsonb" })
            expect(save?.callsOf("setParameter")).toEqual([["colors", '[{"name":"Gold","hex":"#c2996b"}]']])
            expect(save?.callsOf("orUpdate")).toEqual([
                [
                    [
                        "brand_colors",
                        "brand_fonts",
                        "brand_tone",
                        "brand_imagery",
                        "brand_source",
                        "brand_voice",
                        "avoid",
                    ],
                    ["workspace_id"],
                ],
            ])
        })

        it("reads the stored brand, or null without settings", async () => {
            const em = mockEntityManager({
                findOne: [
                    [ContentSettingsEntity, settingsRow()],
                    [ContentSettingsEntity, null],
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
