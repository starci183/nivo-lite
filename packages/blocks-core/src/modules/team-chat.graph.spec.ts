import { TRIGGER } from "@nivo-lite/agent-sdk/names"
import { templateGraphProblems } from "@nivo-lite/agent-sdk/template"
import { teamChatNode } from "../nodes/team/team-chat.node"
import { TEAM_CHAT_GRAPHS, TEAM_CHAT_MODULES, teamChatGraphOf } from "./team-chat.graph"

/** Importing the graphs builds them: the builders throw `TemplateDefinitionError` at load with every problem. */
describe("team-chat graph template", () => {
    it.each(TEAM_CHAT_MODULES)(
        "%s.team-chat: answer \u2192 has-proposal \u2192 propose \u2192 post (\u2192 declined when the post is declined), reached only by a workflow call",
        (moduleKey) => {
            const graph = TEAM_CHAT_GRAPHS[moduleKey]
            expect(graph?.key).toBe(`${moduleKey}.team-chat`)
            expect(graph?.spec.moduleKey).toBe(moduleKey)
            expect(graph?.spec.triggers).toEqual([{ verb: TRIGGER.workflowCalled }])
            expect(graph?.spec.nodes.map((step) => step.key)).toEqual([
                "answer",
                "has-proposal",
                "propose",
                "post",
                "post-declined",
                "declined",
            ])
            expect(graph?.spec.nodes.find((step) => step.key === "answer")).toMatchObject({
                step: "team.chat",
                next: "has-proposal",
            })
            expect(graph?.spec.nodes.find((step) => step.key === "has-proposal")).toMatchObject({
                kind: "if",
                routes: { yes: "propose", no: "post" },
            })
            expect(graph?.spec.nodes.find((step) => step.key === "propose")).toMatchObject({
                step: "team.truth-propose",
                next: "post",
            })
            expect(graph?.spec.nodes.find((step) => step.key === "post")).toMatchObject({
                step: "team.answer-post",
                next: "post-declined",
            })
            // A posted answer ends the turn as before; a post a person declined on its card ends `declined` (rights 11c), no notice.
            const declined = graph?.spec.nodes.find((step) => step.key === "post-declined")
            expect(declined).toMatchObject({ kind: "if", routes: { yes: "declined" } })
            expect(declined).not.toHaveProperty("routes.no")
            expect(graph?.spec.nodes.find((step) => step.key === "declined")).toMatchObject({ kind: "outcome" })
        },
    )

    it.each([...TEAM_CHAT_MODULES, "webdesk"])(
        "%s.team-chat: every ref fits with nullability strict (the proposal that may be null lands on an input that takes null)",
        (moduleKey) => {
            const graph = teamChatGraphOf(moduleKey)
            expect(templateGraphProblems(graph.spec, { nodes: graph.nodes, nullability: "strict" })).toEqual([])
        },
    )

    it.each(TEAM_CHAT_MODULES)("%s.team-chat is seeded active (the default catalogue's seedActive)", (moduleKey) => {
        expect(teamChatGraphOf(moduleKey).spec.catalogue?.seedActive).toBe(true)
    })

    it("version 7 in the compiled graph's catalogue", () => {
        // ledger 2026-11-13 (`nivo-frame.rights`): every graph's catalogue version + 1 (one mode per node changed every compiled document);
        // 2026-11-14 (EF-G): + 1 (a declined answer post ends the turn `declined`).
        // 2026-11-14 (one event pipeline): + 1, the caller's params in `trigger.data`.
        expect(teamChatGraphOf("sales").spec.catalogue).toMatchObject({
            version: 7,
            name: { vi: "Tr\u1ea3 l\u1eddi \u0111\u1ed9i", en: "Answer the team" },
        })
    })

    it("carries a passed catalogue as the compiled graph's; the default is version 7", () => {
        const catalogue = {
            name: { vi: "Tr\u1ea3 l\u1eddi \u0111\u1ed9i", en: "Answer the team" },
            summary: { vi: "Tr\u1ea3 l\u1eddi \u0111\u1ed9i", en: "Answers the team" },
            version: 4,
            publishedAt: "2026-11-12T18:00:00.000Z",
            notes: { vi: "B\u1ea3n 4", en: "Version 4" },
        }
        const graph = teamChatGraphOf("webbooks", teamChatNode, catalogue)
        expect(graph.spec.catalogue).toEqual(catalogue)
        expect(graph.spec.catalogue).toMatchObject({ name: catalogue.name, version: 4 })
        expect(graph.spec.catalogue?.seedActive).toBeUndefined()
        expect(
            teamChatGraphOf("webbooks", teamChatNode, { ...catalogue, seedActive: false }).spec.catalogue?.seedActive,
        ).toBe(false)
        // ledger 2026-11-13 (`nivo-frame.rights`): every graph's catalogue version + 1 (one mode per node changed every compiled document).
        expect(teamChatGraphOf("webbooks").spec.catalogue?.version).toBe(7)
    })

    it("a plugin module builds the same graph around the default turn", () => {
        expect(teamChatGraphOf("webdesk").key).toBe("webdesk.team-chat")
    })
})
