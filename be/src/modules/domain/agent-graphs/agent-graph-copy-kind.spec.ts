import { Test } from "@nestjs/testing"
import { FakeClock, mock } from "@starci/jest-preset"
import { latestTemplateVersion } from "@nivo-lite/agent-sdk/template"
import { graphRow, versionRow } from "@tests/fixtures/builders/agent-graph.builder"
import { wireScope } from "@tests/fixtures/builders/agent-graph-records.builder"
import { CLOCK } from "@modules/platform/clock"
import { EntityEngineService } from "@modules/domain/entity-engine"
import { INSTALLED } from "@modules/domain/installed-plugins"
import { AgentGraphRecordsService } from "./agent-graph-records.service"
import { GRAPH_CHANGE_KINDS } from "./agent-graphs.mapper"
import type { GraphChangeKind } from "./agent-graphs-contract.contracts"
import { AgentGraphsService } from "./agent-graphs.service"
import { TestWorldError, TestWorldErrorCode } from "@tests/world/test-world.error"

/** Every kind the be writes, spelled once per value so a new kind of the type fails to compile here until it is listed. */
const BE_KINDS: Readonly<Record<GraphChangeKind, true>> = {
    seed: true,
    chat: true,
    edit: true,
    conflict: true,
    learned: true,
    template: true,
    rollback: true,
    spec: true,
    copy: true,
}

const MODULES = ["chatbot", "sales"] as const
const AGENT_ID = "0b3c6c1e-6f0e-4d3a-9d43-6a2f5d1e7a01"
const MEMBER_ID = "5f1d2b7c-3a4e-4c8b-9e0f-1a2b3c4d5e6f"

const build = async () => {
    const engine = mock<EntityEngineService>()
    wireScope(engine)
    const records = mock<AgentGraphRecordsService>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            AgentGraphsService,
            { provide: EntityEngineService, useValue: engine },
            { provide: AgentGraphRecordsService, useValue: records },
            { provide: CLOCK, useValue: new FakeClock("2026-11-10T02:00:00.000Z") },
        ],
    }).compile()
    records.graphOf.mockResolvedValue(graphRow())
    records.latestVersion.mockResolvedValue(versionRow(2))
    records.insertVersion.mockResolvedValue(versionRow(3, undefined, "version-3"))
    records.patchGraph.mockResolvedValue(graphRow())
    return { service: moduleRef.get(AgentGraphsService), records }
}

const primaryOf = (moduleKey: string) => {
    const template = INSTALLED.templatesOf(moduleKey).find((candidate) => candidate.primary)
    if (template === undefined) throw new TestWorldError({ code: TestWorldErrorCode.RowMissing, params: { what: `no primary workflow for ${moduleKey}` } })
    return latestTemplateVersion(template).graph
}

describe("agent_graph_versions change kinds", () => {
    it("reads every kind the be writes", () => {
        expect(Object.keys(BE_KINDS).filter((kind) => !GRAPH_CHANGE_KINDS.some((held) => held === kind))).toEqual([])
    })

    it.each(MODULES)(
        "writes a copy of the %s primary workflow as a version of a kind the table holds",
        async (moduleKey) => {
            const { service, records } = await build()

            await service.publish({
                workspaceId: "ws-1",
                agentId: AGENT_ID,
                document: { nodes: [], flow: primaryOf(moduleKey) },
                kind: "copy",
                note: "",
                memberId: MEMBER_ID,
                contextVersionId: null,
            })

            const values = records.insertVersion.mock.calls[0]?.[1]
            expect(values).toMatchObject({ changeKind: "copy" })
            expect(GRAPH_CHANGE_KINDS).toContain(values?.changeKind)
        },
    )
})
