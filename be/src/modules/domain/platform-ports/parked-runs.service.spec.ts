import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { AgentRunParkStoreService, AgentRunResumeService } from "@modules/domain/agent-runs"
import type { ParkedFacts } from "@modules/domain/agent-runs"
import { AgentDirectoryService } from "@modules/domain/agents"
import { MESSAGE_CATALOG } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { ParkedRunsService } from "./parked-runs.service"

const ASKER = { workspaceId: "w1", memberId: "m1", locale: "vi" } as const

const fact = (
    runId: string,
    agentId: string,
    subject: { kind: string; id: string } | null,
    errorCode = "ORDER_STUCK",
): ParkedFacts => ({
    runId,
    agentId,
    subjectKind: subject === null ? "" : subject.kind,
    subjectId: subject === null ? "" : subject.id,
    stepKey: "order.confirm",
    errorCode,
    parkedAt: "2026-11-06T09:00:00.000Z",
})

const build = async (asker: typeof ASKER | { workspaceId: string; memberId: null; locale: "vi" } = ASKER) => {
    const parks = mock<AgentRunParkStoreService>()
    const resumes = mock<AgentRunResumeService>()
    const directory = mock<AgentDirectoryService>()
    const catalog = mock<MessageCatalog>()
    catalog.get.mockImplementation((key) => (key === "errors.ORDER_STUCK" ? "Don hang bi ket" : key))
    directory.find.mockImplementation((_workspace, agentId) =>
        Promise.resolve(
            agentId === "gone" ? null : { id: agentId, name: agentId, module: agentId, canTagAgentIds: [] },
        ),
    )
    const moduleRef = await Test.createTestingModule({
        providers: [
            ParkedRunsService,
            { provide: MESSAGE_CATALOG, useValue: catalog },
            { provide: AgentRunParkStoreService, useValue: parks },
            { provide: AgentRunResumeService, useValue: resumes },
            { provide: AgentDirectoryService, useValue: directory },
        ],
    }).compile()
    return { port: moduleRef.get(ParkedRunsService).portFor(asker), parks, resumes }
}

describe("ParkedRunsService list", () => {
    it("lists the parked runs with module, subject, step and the failure in words", async () => {
        const { port, parks } = await build()
        parks.parkedFacts.mockResolvedValue([
            fact("r1", "sales", { kind: "sales.order", id: "o1" }),
            fact("r2", "chatbot", null, "UNKNOWN_CODE"),
        ])

        const listed = await port.list({}, 20)

        expect(listed.total).toBe(2)
        expect(listed.rows[0]).toEqual({
            id: "r1",
            module: "sales",
            subjectKind: "sales.order",
            subjectId: "o1",
            step: "order.confirm",
            errorCode: "ORDER_STUCK",
            errorWords: "Don hang bi ket",
            parkedAt: "2026-11-06T09:00:00.000Z",
        })
        expect(listed.rows[1]).toMatchObject({ module: "chatbot", subjectKind: "", errorWords: "UNKNOWN_CODE" })
        expect(parks.parkedFacts).toHaveBeenCalledWith("w1", 100)
    })

    it("narrows by module and subject, counts what matches and cuts to the limit", async () => {
        const { port, parks } = await build()
        parks.parkedFacts.mockResolvedValue([
            fact("r1", "sales", { kind: "sales.order", id: "o1" }),
            fact("r2", "sales", { kind: "sales.order", id: "o2" }),
            fact("r3", "chatbot", { kind: "chat.conversation", id: "c1" }),
        ])
        const sales = await port.list({ module: "sales" }, 1)
        expect(sales.rows.map((row) => row.id)).toEqual(["r1"])
        expect(sales.total).toBe(2)
        expect((await port.list({ subjectKind: "chat.conversation" }, 5)).rows.map((row) => row.id)).toEqual(["r3"])
        expect((await port.list({ subjectId: "o2" }, 5)).rows.map((row) => row.id)).toEqual(["r2"])
    })

    it("names no module for a run of an agent the workspace no longer holds", async () => {
        const { port, parks } = await build()
        parks.parkedFacts.mockResolvedValue([fact("r1", "gone", null)])
        expect((await port.list({}, 5)).rows[0]?.module).toBe("")
    })
})

describe("ParkedRunsService find and resume", () => {
    it("answers where a run stands, with its module, and null for a run the workspace does not hold", async () => {
        const { port, parks } = await build()
        parks.standingOf.mockResolvedValueOnce({ agentId: "sales", parked: true })
        parks.standingOf.mockResolvedValueOnce({ agentId: "gone", parked: false })
        parks.standingOf.mockResolvedValueOnce(null)
        await expect(port.find("r1")).resolves.toEqual({ module: "sales", parked: true })
        await expect(port.find("r2")).resolves.toEqual({ module: "", parked: false })
        await expect(port.find("r3")).resolves.toBeNull()
    })

    it("resumes through the engine's own resume under the asker's seat, true only when the run went on", async () => {
        const { port, resumes } = await build()
        resumes.resume.mockResolvedValueOnce({ kind: "resumed", stepKey: "order.confirm", workspaceId: "w1" })
        resumes.resume.mockResolvedValueOnce({ kind: "not_parked" })
        await expect(port.resume("r1")).resolves.toBe(true)
        await expect(port.resume("r1")).resolves.toBe(false)
        expect(resumes.resume.mock.calls[0]?.[0]).toMatchObject({ workspaceId: "w1", runId: "r1", actor: "m1" })
    })

    it("resumes as the owner when the asker has no seat", async () => {
        const { port, resumes } = await build({ workspaceId: "w1", memberId: null, locale: "vi" })
        resumes.resume.mockResolvedValue({ kind: "not_found" })
        await expect(port.resume("r9")).resolves.toBe(false)
        expect(resumes.resume.mock.calls[0]?.[0]).toMatchObject({ actor: "owner" })
    })
})
