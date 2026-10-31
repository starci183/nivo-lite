import { Test } from "@nestjs/testing"
import { FakeClock, mock } from "@starci/jest-preset"
import { AgentTurnsService, AgentWorkSettingsService } from "@modules/domain/agent-work"
import type { AgentRunningTurn, AgentWorkState } from "@modules/domain/agent-work"
import { Secret } from "@modules/platform/config"
import { CLOCK } from "@modules/platform/clock"
import { AgentTurnAccessService } from "./agent-turn-access.service"
import { AGENT_TURNS_OPTIONS } from "./agent-turns.decorators"
import { signBridgeToken } from "./bridge-credential.policy"
import type { AgentTurnsOptions } from "./agent-turns.options"

const NOW = "2027-01-15T08:00:00.000Z"
const NOW_SECONDS = Math.floor(new Date(NOW).getTime() / 1000)
const SECRET = "bridge-secret"
const RUNTIME = "ws-0123abcd-accounting"
const SESSION = `agent:${RUNTIME}:work`

const running = (over: Partial<AgentRunningTurn> = {}): AgentRunningTurn => ({
    turnId: "turn-1",
    workspaceId: "ws-1",
    agentId: "agent-1",
    wakeId: "wake-1",
    source: "tag",
    threadKey: SESSION,
    context: { room: "sales", authorUserId: "user-9" },
    ...over,
})

const credential = (over: Partial<{ agentId: string; sessionKey: string; exp: number }> = {}): string =>
    signBridgeToken(SECRET, { agentId: RUNTIME, sessionKey: SESSION, exp: NOW_SECONDS + 30, ...over })

const state = (workEnabled: boolean): AgentWorkState => ({
    agentId: "agent-1",
    workEnabled,
    failures: 0,
    breakerUntil: null,
    lastTurnAt: null,
    backgroundDay: null,
    backgroundTurns: 0,
})

interface Switches {
    readonly agent?: boolean
    readonly workspace?: boolean
}

const build = async (
    turns: ReadonlyArray<AgentRunningTurn> = [running()],
    bridgeSecret: Secret | null = new Secret(SECRET),
    { agent = true, workspace = true }: Switches = {},
) => {
    const service = mock<AgentTurnsService>({ runningOn: jest.fn(() => Promise.resolve(turns)) })
    const settings = mock<AgentWorkSettingsService>({
        stateOf: jest.fn(() => Promise.resolve(state(agent))),
        settingsOf: jest.fn(() =>
            Promise.resolve({
                workspaceId: "ws-1",
                workEnabled: workspace,
                road: "core" as const,
                backgroundDailyCap: 50,
            }),
        ),
    })
    const options: AgentTurnsOptions = { bridgeSecret }
    const moduleRef = await Test.createTestingModule({
        providers: [
            AgentTurnAccessService,
            { provide: AGENT_TURNS_OPTIONS, useValue: options },
            { provide: CLOCK, useValue: new FakeClock(NOW) },
            { provide: AgentTurnsService, useValue: service },
            { provide: AgentWorkSettingsService, useValue: settings },
        ],
    }).compile()
    return { access: moduleRef.get(AgentTurnAccessService), service, settings }
}

describe("AgentTurnAccessService.admit", () => {
    it("builds the context of a call from the running turn: workspace, agent, wake and author, with no conversation for a tag", async () => {
        const { access, service } = await build()

        await expect(access.admit(credential())).resolves.toEqual({
            jobId: "wake-1",
            workspaceId: "ws-1",
            agentId: "agent-1",
            turnId: "turn-1",
            wakeId: "wake-1",
            source: "tag",
            conversationId: null,
            authorUserId: "user-9",
        })
        expect(service.runningOn).toHaveBeenCalledWith(RUNTIME)
    })

    it("gives a customer turn its conversation and keeps the message as the job, so what the turn kept is found again", async () => {
        const { access } = await build([
            running({ source: "customer", context: { conversationId: "conv-7", messageId: "msg-7" } }),
        ])

        await expect(access.admit(credential())).resolves.toMatchObject({
            jobId: "msg-7",
            conversationId: "conv-7",
            source: "customer",
            authorUserId: null,
        })
    })

    it("uses the wake as the job of a customer turn that carries no message", async () => {
        const { access } = await build([running({ source: "customer", context: { conversationId: "conv-7" } })])

        await expect(access.admit(credential())).resolves.toMatchObject({ jobId: "wake-1" })
    })

    it("matches the session whatever its case", async () => {
        const { access } = await build([running({ threadKey: SESSION.toUpperCase() })])

        await expect(access.admit(credential())).resolves.not.toBeNull()
    })

    it("refuses a call when no turn is running on the agent", async () => {
        const { access } = await build([])

        await expect(access.admit(credential())).resolves.toBeNull()
    })

    it("refuses a session that is not the session of a running turn of the agent", async () => {
        const { access } = await build([running({ threadKey: `agent:${RUNTIME}:another` })])

        await expect(access.admit(credential())).resolves.toBeNull()
    })
})

describe("AgentTurnAccessService.admit, which turn a call is for", () => {
    it("refuses a session that names more than one running turn, since it cannot tell whose call it is", async () => {
        const { access } = await build([running(), running({ turnId: "turn-2", agentId: "agent-2", wakeId: "wake-2" })])

        await expect(access.admit(credential())).resolves.toBeNull()
    })

    it("tells two agents of one runtime agent apart by the session each turn runs in", async () => {
        const other = `${SESSION}:agent-2`
        const { access } = await build([
            running({ threadKey: `${SESSION}:agent-1` }),
            running({ turnId: "turn-2", agentId: "agent-2", wakeId: "wake-2", threadKey: other }),
        ])

        await expect(access.admit(credential({ sessionKey: other }))).resolves.toMatchObject({
            turnId: "turn-2",
            agentId: "agent-2",
        })
    })

    it.each([
        ["the agent", { agent: false }],
        ["the workspace", { workspace: false }],
    ])("refuses a call once work is switched off for %s, though the turn still runs", async (_who, switches) => {
        const { access, settings } = await build([running()], new Secret(SECRET), switches)

        await expect(access.admit(credential())).resolves.toBeNull()
        expect(settings.stateOf).toHaveBeenCalledWith("agent-1")
        expect(settings.settingsOf).toHaveBeenCalledWith("ws-1")
    })

    it("refuses a credential signed with the wrong secret, before it looks at any turn", async () => {
        const { access, service } = await build()
        const forged = signBridgeToken("other-secret", { agentId: RUNTIME, sessionKey: SESSION, exp: NOW_SECONDS + 30 })

        await expect(access.admit(forged)).resolves.toBeNull()
        expect(service.runningOn).not.toHaveBeenCalled()
    })

    it("refuses an expired credential", async () => {
        const { access, service } = await build()

        await expect(access.admit(credential({ exp: NOW_SECONDS - 1 }))).resolves.toBeNull()
        expect(service.runningOn).not.toHaveBeenCalled()
    })

    it("refuses every call while no bridge secret is configured", async () => {
        const { access, service } = await build([running()], null)

        await expect(access.admit(credential())).resolves.toBeNull()
        expect(service.runningOn).not.toHaveBeenCalled()
    })
})
