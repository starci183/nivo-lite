import { VERB_SHARED_REFUSED, sharedVerbProblems } from "@nivo-lite/agent-sdk/template"
import { INSTALLED } from "@modules/domain/installed-plugins"
import { templateFlowProblems } from "./flow.policy"

describe("TRIGGER_VERB_SHARED over the installed template agents", () => {
    const agents = INSTALLED.templateAgents()

    it("the dry run: no installed agent shares a verb without disjoint exact conditions, and the switch is in step with it", () => {
        // Judged whatever the switch says: the list a package owner clears before the switch may go on.
        const found = agents.flatMap((agent) =>
            sharedVerbProblems(agent).map((problem) => `${problem.at} (${problem.detail ?? ""})`),
        )
        expect(agents.map((agent) => agent.key).sort()).toEqual(
            expect.arrayContaining(["chatbot", "sales", "webbooks", "webdesk", "webmail", "webrenew", "websales"]),
        )
        expect(found).toEqual([])
        expect(VERB_SHARED_REFUSED).toBe(found.length === 0)
    })

    it("the save check of every installed template flow raises none", () => {
        const raised = agents.flatMap((agent) =>
            INSTALLED.templatesOf(agent.key).flatMap((template) =>
                template.versions.flatMap((version) =>
                    (templateFlowProblems(version.graph) ?? [])
                        .filter((problem) => problem.code === "TRIGGER_VERB_SHARED")
                        .map((problem) => `${template.id}@${String(version.version)} ${problem.at}`),
                ),
            ),
        )
        expect(raised).toEqual([])
    })
})
