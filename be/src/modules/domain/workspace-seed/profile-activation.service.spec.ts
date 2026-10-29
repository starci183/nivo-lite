import { Test } from "@nestjs/testing"
import {
    SEED_OWNER,
    SEED_WS,
    seedDraftOf as draftOf,
    seedInstallationOf as installationOf,
} from "@tests/fixtures/builders/workspace-seed.builder"
import { mock } from "@starci/jest-preset"
import { InstallationRecordsService } from "@modules/domain/module-installations"
import { MODULE_CATALOG, ModuleReadinessService, SetupChatService } from "@modules/domain/modules"
import { WorkspaceSeedErrorCode } from "./errors/workspace-seed.error"
import { HAKUEN_PROFILE } from "./profiles/hakuen-profile.templates"
import { ProfileActivationService } from "./profile-activation.service"
import type { ProfileAgent, ProfileInstallation, ProfileSetupAnswer } from "./workspace-profile.contracts"

const WS = SEED_WS
const OWNER = SEED_OWNER
const TARGET = { workspaceId: WS, ownerId: OWNER }
const ANSWERS: ReadonlyArray<ProfileSetupAnswer> = [
    { gate: "identity", evidence: "HAKUEN" },
    { gate: "tone", evidence: "warm" },
]
const AGENT: ProfileAgent = {
    module: "chatbot",
    name: "ai-sales",
    handle: "ai-sales",
    role: "role",
    instructions: "instructions",
    room: null,
    tools: [],
    setup: ANSWERS,
}
const keptOf = (installation = installationOf()): ProfileInstallation => ({
    handle: "ai-sales",
    installation,
    answers: ANSWERS,
})
const confirmed = (evidence: string) => ({
    status: "confirmed" as const,
    evidence,
    confirmed_by: "Owner",
    confirmed_at: "2026-10-21T00:00:00.000Z",
})

const build = async () => {
    const installations = mock<InstallationRecordsService>()
    const setup = mock<SetupChatService>()
    setup.openDraft.mockResolvedValue(draftOf())
    const readiness = mock<ModuleReadinessService>()
    readiness.settle.mockResolvedValue("ready")
    const moduleRef = await Test.createTestingModule({
        providers: [
            ProfileActivationService,
            { provide: InstallationRecordsService, useValue: installations },
            { provide: SetupChatService, useValue: setup },
            { provide: ModuleReadinessService, useValue: readiness },
        ],
    }).compile()
    return { service: moduleRef.get(ProfileActivationService), installations, setup, readiness }
}

describe("ProfileActivationService", () => {
    describe("install", () => {
        it("answers the installation that already drives the agent", async () => {
            const { service, installations } = await build()
            installations.ofAgent.mockResolvedValue(installationOf())

            await expect(service.install(WS, "a1", AGENT)).resolves.toEqual(installationOf())
            expect(installations.insert).not.toHaveBeenCalled()
        })

        it("installs the module in setup for a new agent and reads it back", async () => {
            const { service, installations } = await build()
            installations.ofAgent.mockResolvedValueOnce(null).mockResolvedValueOnce(installationOf())

            await expect(service.install(WS, "a1", AGENT)).resolves.toEqual(installationOf())
            expect(installations.insert).toHaveBeenCalledWith({
                workspaceId: WS,
                moduleKey: "chatbot",
                name: "ai-sales",
                agentId: "a1",
                operatingMode: "assist",
            })
            expect(installations.ofAgent.mock.calls).toEqual([
                [WS, "a1"],
                [WS, "a1"],
            ])
        })

        it("fails the run when the new installation cannot be read back", async () => {
            const { service, installations } = await build()
            installations.ofAgent.mockResolvedValue(null)

            await expect(service.install(WS, "a1", AGENT)).rejects.toMatchObject({
                code: WorkspaceSeedErrorCode.RowMissing,
            })
        })
    })
})

describe("ProfileActivationService", () => {
    describe("activate applies the setup", () => {
        it("confirms the answers that changed as the owner's wording, applies the draft, then settles it", async () => {
            const { service, setup, readiness } = await build()
            setup.openDraft.mockResolvedValue(draftOf({ gateEvidence: { tone: confirmed("warm") } }))
            readiness.settle.mockResolvedValue("needs_connection")

            await expect(service.activate(TARGET, [keptOf()])).resolves.toEqual({ "ai-sales": "needs_connection" })

            expect(setup.openDraft).toHaveBeenCalledWith(installationOf(), "vi")
            expect(setup.setGate.mock.calls).toEqual([[OWNER, WS, "s1", "identity", "edit", "HAKUEN"]])
            expect(setup.apply).toHaveBeenCalledWith(OWNER, WS, "i1", "vi")
            expect(readiness.settle).toHaveBeenCalledWith(WS, "i1")
            expect(setup.apply.mock.invocationCallOrder[0] ?? 0).toBeLessThan(
                readiness.settle.mock.invocationCallOrder[0] ?? 0,
            )
        })

        it("applies a first version even when the draft already holds every answer", async () => {
            const { service, setup } = await build()
            setup.openDraft.mockResolvedValue(
                draftOf({ gateEvidence: { identity: confirmed("HAKUEN"), tone: confirmed("warm") } }),
            )

            await service.activate(TARGET, [keptOf()])

            expect(setup.setGate).not.toHaveBeenCalled()
            expect(setup.apply).toHaveBeenCalledWith(OWNER, WS, "i1", "vi")
        })

        it("applies a changed answer again on an installation that already runs on a version", async () => {
            const { service, setup } = await build()
            setup.openDraft.mockResolvedValue(
                draftOf({
                    gateEvidence: { identity: confirmed("HAKUEN"), tone: { status: "proposed", evidence: "warm" } },
                }),
            )

            await service.activate(TARGET, [keptOf(installationOf({ status: "live", activeContextVersionId: "v1" }))])

            expect(setup.setGate.mock.calls).toEqual([[OWNER, WS, "s1", "tone", "edit", "warm"]])
            expect(setup.apply).toHaveBeenCalledTimes(1)
        })
    })
})

describe("ProfileActivationService", () => {
    describe("activate on a re-run and on a refusal", () => {
        it("leaves an applied installation as it is when the answers are the same and still settles it", async () => {
            const { service, setup, readiness } = await build()
            setup.openDraft.mockResolvedValue(
                draftOf({ revision: 2, gateEvidence: { identity: confirmed("HAKUEN"), tone: confirmed("warm") } }),
            )
            readiness.settle.mockResolvedValue("live")
            const applied = installationOf({ status: "live", activeContextVersionId: "v1" })

            await expect(service.activate(TARGET, [keptOf(applied)])).resolves.toEqual({ "ai-sales": "live" })
            expect(setup.setGate).not.toHaveBeenCalled()
            expect(setup.apply).not.toHaveBeenCalled()
            expect(readiness.settle).toHaveBeenCalledWith(WS, "i1")
        })

        it.each([
            ["the setup chat refuses to apply while a gate is unconfirmed", "apply", "MODULES_GATES_UNCONFIRMED"],
            ["the module has no such gate", "setGate", "MODULES_GATE_UNKNOWN"],
        ] as const)("fails the run when %s, before settling", async (_case, step, code) => {
            const { service, setup, readiness } = await build()
            setup[step].mockRejectedValue({ code })

            await expect(service.activate(TARGET, [keptOf()])).rejects.toMatchObject({ code })
            expect(readiness.settle).not.toHaveBeenCalled()
        })
    })
})

describe("ProfileActivationService", () => {
    describe("the HAKUEN setup answers", () => {
        it("answer exactly the gates of each agent's module, each with evidence", () => {
            for (const agent of HAKUEN_PROFILE.agents) {
                const module = MODULE_CATALOG.find((candidate) => candidate.key === agent.module)
                expect(agent.setup.map((answer) => answer.gate).sort()).toEqual(
                    (module?.gates ?? []).map((gate) => gate.key).sort(),
                )
                expect(agent.setup.every((answer) => answer.evidence.trim().length > 0)).toBe(true)
            }
        })

        it("bring the five HAKUEN installations to their settled status: four run, accounting waits for its bank connection", async () => {
            const { service, setup, readiness, installations } = await build()
            readiness.settle.mockImplementation((_workspaceId, installationId) =>
                Promise.resolve(installationId === "installation-ai-ke-toan" ? "needs_connection" : "ready"),
            )
            const kept = HAKUEN_PROFILE.agents.map((agent) => ({
                handle: agent.handle,
                installation: installationOf({ id: `installation-${agent.handle}`, moduleKey: agent.module }),
                answers: agent.setup,
            }))

            await expect(service.activate(TARGET, kept)).resolves.toEqual({
                "ai-marketing": "live",
                "ai-editor": "live",
                "ai-sales": "live",
                "ai-cskh": "live",
                "ai-ke-toan": "needs_connection",
            })
            // Only a running agent answers customers: the four that are ready are switched on, the one that waits is not.
            expect(installations.setLive).toHaveBeenCalledTimes(4)
            expect(installations.setLive).not.toHaveBeenCalledWith(WS, "installation-ai-ke-toan", true, false)
            const gates = HAKUEN_PROFILE.agents.reduce((count, agent) => count + agent.setup.length, 0)
            expect(setup.setGate).toHaveBeenCalledTimes(gates)
            expect(setup.apply).toHaveBeenCalledTimes(HAKUEN_PROFILE.agents.length)
        })
    })
})
