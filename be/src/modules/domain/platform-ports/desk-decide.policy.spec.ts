import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { invokeAction } from "@nivo-lite/agent-sdk/invoke"
import type { ActionDefinition } from "@nivo-lite/agent-sdk/block"
import type { PortProvider, RunContext } from "@nivo-lite/agent-sdk/port"
import { InstallationRecordsService } from "@modules/domain/module-installations"
import type { InstallationRecord } from "@modules/domain/module-installations"
import { INSTALLED } from "@modules/domain/installed-plugins"
import { AGENT_DESK_PORT_ID } from "./agent-desk.contracts"
import type { DeskAsker } from "./agent-desk.contracts"
import { AgentDeskService } from "./agent-desk.service"
import { deskDecideTargetOf } from "./desk-decide.policy"
import { DeskFlowsService } from "./desk-flows.service"
import { DeskReachService } from "./desk-reach.service"
import { DeskRunsService } from "./desk-runs.service"
import { DeskWaitingService } from "./desk-waiting.service"

const INSTALLATION = "0b9d3f8e-1c2a-4b5d-8e6f-7a8b9c0d1e2f"
const OTHER = "2d3e4f50-6172-4839-8a4b-5c6d7e8f9012"
const ITEM = "3e4f5061-7283-4940-9b5c-6d7e8f901234"
const ASKER: DeskAsker = { workspaceId: "ws-1", memberId: "seat-1", locale: "vi" }
const CONTEXT: RunContext = { workspaceId: "ws-1", memberId: "seat-1", now: new Date(0), timeZone: "UTC", locale: "vi" }

/** The platform module's `platform.approval-decide`, as the door registers it. */
const DECIDE: ActionDefinition | undefined = INSTALLED.moduleOf("platform")?.actions.find((one) => one.id === "platform.approval-decide")

/** Runs the declared action as the door does; null when the module no longer declares it (the first expectation then fails). */
const decided = (provider: PortProvider, input: unknown) => {
    expect(DECIDE).toBeDefined()
    return DECIDE === undefined ? Promise.resolve(null) : invokeAction(DECIDE, provider, input, CONTEXT)
}

const build = async () => {
    const installations = mock<InstallationRecordsService>()
    installations.find.mockImplementation((_workspaceId, id) =>
        Promise.resolve(id === INSTALLATION ? mock<InstallationRecord>({ id, agentId: "agent-1" }) : null),
    )
    const waits = mock<DeskWaitingService>()
    waits.decide.mockResolvedValue({ kind: "decided", status: "done" })
    const moduleRef = await Test.createTestingModule({
        providers: [
            AgentDeskService,
            { provide: InstallationRecordsService, useValue: installations },
            { provide: DeskFlowsService, useValue: mock<DeskFlowsService>() },
            { provide: DeskWaitingService, useValue: waits },
            { provide: DeskRunsService, useValue: mock<DeskRunsService>() },
            { provide: DeskReachService, useValue: mock<DeskReachService>() },
        ],
    }).compile()
    const desk = moduleRef.get(AgentDeskService).portFor(ASKER)
    const provider: PortProvider = {
        implementationOf: (port) => (port.id === AGENT_DESK_PORT_ID ? desk : undefined),
    }
    return { desk, provider, waits, installations }
}

describe("deskDecideTargetOf: the target of a verdict, parsed strictly", () => {
    it("takes an installation and a row id, or the row key `<installation>~<row id>` of the same installation", () => {
        expect(deskDecideTargetOf(INSTALLATION, ITEM)).toEqual({ installation: INSTALLATION, id: ITEM })
        expect(deskDecideTargetOf(INSTALLATION, `${INSTALLATION}~${ITEM}`)).toEqual({
            installation: INSTALLATION,
            id: ITEM,
        })
    })

    it.each([
        ["no id", INSTALLATION, "item-1"],
        ["no installation id", "inst-1", ITEM],
        ["a third part", INSTALLATION, `${INSTALLATION}~${ITEM}~${ITEM}`],
        ["an empty row", INSTALLATION, `${INSTALLATION}~`],
        ["an empty installation", INSTALLATION, `~${ITEM}`],
        ["another installation in the key", INSTALLATION, `${OTHER}~${ITEM}`],
    ])("refuses %s", (_case, installation, id) => {
        expect(deskDecideTargetOf(installation, id)).toBeNull()
    })
})

describe("platform.approval-decide through the desk port", () => {
    it("decides the queue's row key `{ id: <installation>~<row id>, command }` as the agent's approval", async () => {
        const { provider, waits, installations } = await build()

        const result = await decided(provider, { id: `${INSTALLATION}~${ITEM}`, command: "approve" })

        expect(result).toMatchObject({ ok: true })
        expect(installations.find).toHaveBeenCalledWith("ws-1", INSTALLATION)
        expect(waits.decide).toHaveBeenCalledWith(ASKER, "agent-1", { id: ITEM, verdict: "approve" })
    })

    it("keeps the port's own shape `decide(installation, { id, verdict })`", async () => {
        const { desk, waits } = await build()

        await expect(desk.decide(INSTALLATION, { id: ITEM, verdict: "decline" })).resolves.toEqual({
            kind: "decided",
            status: "done",
        })
        expect(waits.decide).toHaveBeenCalledWith(ASKER, "agent-1", { id: ITEM, verdict: "decline" })
    })

    it.each([
        ["a key with a third part", `${INSTALLATION}~${ITEM}~x`],
        ["a key whose row is no id", `${INSTALLATION}~item-1`],
        ["a key whose installation is no id", `inst-1~${ITEM}`],
        ["no key at all", ITEM],
    ])("refuses %s, reading nothing and deciding nothing", async (_case, id) => {
        const { provider, waits, installations } = await build()

        const result = await decided(provider, { id, command: "approve" })

        expect(result).toMatchObject({ ok: false, reason: "refused" })
        expect(installations.find).not.toHaveBeenCalled()
        expect(waits.decide).not.toHaveBeenCalled()
    })

    it("refuses a row of an installation the workspace does not have as no longer waiting here", async () => {
        const { desk, waits } = await build()

        await expect(desk.decide(OTHER, { id: ITEM, verdict: "approve" })).resolves.toEqual({
            kind: "refused",
            code: "not_waiting_here",
        })
        await expect(desk.decide("inst-1", { id: ITEM, verdict: "approve" })).resolves.toEqual({
            kind: "refused",
            code: "row_invalid",
        })
        expect(waits.decide).not.toHaveBeenCalled()
    })
})
