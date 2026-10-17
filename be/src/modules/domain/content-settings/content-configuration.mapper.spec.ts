import { Test } from "@nestjs/testing"
import {
    ContentAutomationMarksMapper,
    toContentBrandSettings as realToContentBrandSettings,
} from "./content-configuration.mapper"
import type { ContentBrandRow } from "./persistence/content-configuration.rows"

const MAPPER = Symbol("ContentBrandSettingsMapper")

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: MAPPER, useValue: [realToContentBrandSettings] }],
    }).compile()
    return moduleRef.get<readonly [typeof realToContentBrandSettings]>(MAPPER)[0]
}

const row: ContentBrandRow = {
    workspace_id: "ws-1",
    brand_voice: "warm",
    avoid: "slang",
    cta: "Book",
    hashtags: ["#tea"],
    automations: { today_reminder: true, offer_draft: false, weekly_summary: 1 },
    marks: { week: "2026-10-12", count: 3 },
}

describe("toContentBrandSettings", () => {
    it("supplies blanks when the workspace has no saved brand", async () => {
        const toContentBrandSettings = await buildSubject()
        expect(toContentBrandSettings("ws-1")).toEqual({
            workspaceId: "ws-1",
            brandVoice: "",
            avoid: "",
            cta: "",
            hashtags: [],
            automations: { today_reminder: false, offer_draft: false, weekly_summary: false },
            marks: {},
        })
    })

    it("keeps stored switches that are exactly true and string marks only", async () => {
        const toContentBrandSettings = await buildSubject()
        expect(toContentBrandSettings("ws-1", row)).toEqual({
            workspaceId: "ws-1",
            brandVoice: "warm",
            avoid: "slang",
            cta: "Book",
            hashtags: ["#tea"],
            automations: { today_reminder: true, offer_draft: false, weekly_summary: false },
            marks: { week: "2026-10-12" },
        })
    })

    it("treats a missing marks object as none", async () => {
        const toContentBrandSettings = await buildSubject()
        const bare: ContentBrandRow = { ...row }
        Reflect.deleteProperty(bare, "marks")
        expect(toContentBrandSettings("ws-1", bare).marks).toEqual({})
    })
})

describe("ContentAutomationMarksMapper", () => {
    it("lists the recorded marks as key and value", async () => {
        const toContentBrandSettings = await buildSubject()
        const settings = toContentBrandSettings("ws-1", row)
        expect(new ContentAutomationMarksMapper(settings).marks).toEqual([{ key: "week", value: "2026-10-12" }])
    })

    it("lists nothing when no mark is stored", async () => {
        const toContentBrandSettings = await buildSubject()
        expect(new ContentAutomationMarksMapper(toContentBrandSettings("ws-1")).marks).toEqual([])
    })
})
