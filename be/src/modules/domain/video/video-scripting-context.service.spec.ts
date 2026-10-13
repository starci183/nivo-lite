import { Test } from "@nestjs/testing"
import { builder, mock, mockEntityManager } from "@starci/jest-preset"
import { AuthorityService } from "@modules/domain/authority"
import { BrainFactsService } from "@modules/domain/brain-facts"
import type { FactRecord } from "@modules/domain/brain-facts"
import { KnowledgeSearchService } from "@modules/domain/knowledge"
import type { Passage } from "@modules/domain/knowledge"
import type { VideoScriptingRow } from "./persistence/video-scripting.rows"
import { READ_SCRIPT_BASE, READ_SCRIPT_SETUP } from "./persistence/video-scripting.sql"
import { VideoScriptingContextService } from "./video-scripting-context.service"
import { VIDEO_SCRIPT_GOALS } from "./video-scripting.templates"

const WS = "workspace-1"

const projectOf = builder<VideoScriptingRow>({
    id: "project-1",
    title: "Spring offer",
    goal: "offer",
    aspect: "9:16",
    target_seconds: 30,
    status: "draft",
    inputs: { notes: "fresh bread" },
    script_meta: {},
    updated_at: "2026-10-13T09:00:00.000Z",
    render_status: null,
    workspace_name: "Bakery",
    shop_name: null,
})

const passageOf = builder<Passage>({
    layer: "business",
    id: "passage-1",
    sourceId: "source-1",
    module: "video",
    kind: "document",
    title: "Menu",
    content: "Bread 20k",
    score: 1,
    visibility: "public",
    topic: null,
})

const FACT = mock<FactRecord>({ subjectLabel: "Bread", attributeLabel: "Price", value: "20k" })

const build = async () => {
    const facts = mock<BrainFactsService>()
    facts.search.mockResolvedValue([])
    const authority = mock<AuthorityService>()
    authority.load.mockResolvedValue(null)
    const knowledge = mock<KnowledgeSearchService>()
    knowledge.passagesText.mockResolvedValue([])
    const moduleRef = await Test.createTestingModule({
        providers: [
            VideoScriptingContextService,
            { provide: BrainFactsService, useValue: facts },
            { provide: AuthorityService, useValue: authority },
            { provide: KnowledgeSearchService, useValue: knowledge },
        ],
    }).compile()
    return { context: moduleRef.get(VideoScriptingContextService), facts, authority, knowledge }
}

describe("VideoScriptingContextService", () => {
    describe("forProject", () => {
        it("answers nothing when the workspace has no rules, setup, voice, facts or documents", async () => {
            const { context } = await build()
            const tx = mockEntityManager({
                query: [
                    [READ_SCRIPT_SETUP, []],
                    [READ_SCRIPT_BASE, []],
                ],
            })

            await expect(context.forProject(tx, WS, projectOf(), "")).resolves.toBe("")
        })

        it("assembles every section through the customer lens of the project's goal", async () => {
            const { context, facts, authority, knowledge } = await build()
            facts.search.mockResolvedValue([FACT])
            authority.load.mockResolvedValue({
                policies: "",
                reply_style: "Short",
                brand_voice: "Warm",
                limits_note: "",
            })
            knowledge.passagesText.mockResolvedValue([
                passageOf(),
                passageOf({ title: "Costs", content: "secret", visibility: "internal" }),
            ])
            const tx = mockEntityManager({
                query: [
                    [READ_SCRIPT_SETUP, [{ snapshot: { summary: "Sell bread" } }]],
                    [READ_SCRIPT_BASE, [{ title: "Honesty", body: "Never invent prices" }]],
                ],
            })

            const text = await context.forProject(tx, WS, projectOf(), "Menu source")

            expect(text).toBe(
                [
                    "NIVO BASE RULES:\n## Honesty\nNever invent prices",
                    "APPROVED VIDEO CONFIGURATION:\nSell bread",
                    "HOUSE VOICE AND CLAIM LIMITS:\nWarm\nShort",
                    "PUBLIC FACTS:\nBread - Price: 20k",
                    "PUBLIC BUSINESS KNOWLEDGE:\n- Menu: Bread 20k",
                ].join("\n\n"),
            )
            const query = `${VIDEO_SCRIPT_GOALS.offer?.label.vi ?? ""} fresh bread Menu source`
            expect(facts.search).toHaveBeenCalledWith(WS, "customer", "video", null, query, 6)
            expect(knowledge.passagesText).toHaveBeenCalledWith(
                { workspaceId: WS, module: "video", audience: "customer", installationId: null },
                query,
                6,
            )
            expect(authority.load).toHaveBeenCalledWith({ workspaceId: WS })
        })

        it("uses the custom goal for an unknown one", async () => {
            const { context, facts } = await build()
            const tx = mockEntityManager({
                query: [
                    [READ_SCRIPT_SETUP, []],
                    [READ_SCRIPT_BASE, []],
                ],
            })

            await context.forProject(tx, WS, projectOf({ goal: "unknown", inputs: {} }), "")

            expect(facts.search.mock.calls[0]?.[4]).toBe(`${VIDEO_SCRIPT_GOALS.custom.label.vi}  `)
        })
    })
})
