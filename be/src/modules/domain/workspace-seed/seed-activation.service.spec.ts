import { Test } from "@nestjs/testing"
import {
    SEED_OWNER,
    SEED_WS,
    seedDraftOf as draftOf,
    seedInstallationOf as installationOf,
} from "@tests/fixtures/builders/workspace-seed.builder"
import { mock } from "@starci/jest-preset"
import { InstallationRecordsService } from "@modules/domain/module-installations"
import { ModuleReadinessService, SetupChatService } from "@modules/domain/modules"
import { SeedActivationService } from "./seed-activation.service"
import type { SeedInstallation, SeedSetupAnswer } from "./seed-activation.contracts"

const WS = SEED_WS
const OWNER = SEED_OWNER
const TARGET = { workspaceId: WS, ownerId: OWNER }
const ANSWERS: ReadonlyArray<SeedSetupAnswer> = [
    { gate: "identity", evidence: "Shop" },
    { gate: "tone", evidence: "warm" },
]
const keptOf = (installation = installationOf()): SeedInstallation => ({
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
            SeedActivationService,
            { provide: InstallationRecordsService, useValue: installations },
            { provide: SetupChatService, useValue: setup },
            { provide: ModuleReadinessService, useValue: readiness },
        ],
    }).compile()
    return { service: moduleRef.get(SeedActivationService), installations, setup, readiness }
}

describe("SeedActivationService", () => {
    describe("activate applies the setup", () => {
        it("confirms the answers that changed as the owner's wording, applies the draft, then settles it", async () => {
            const { service, setup, readiness } = await build()
            setup.openDraft.mockResolvedValue(draftOf({ gateEvidence: { tone: confirmed("warm") } }))
            readiness.settle.mockResolvedValue("needs_connection")

            await expect(service.activate(TARGET, [keptOf()])).resolves.toEqual({ "ai-sales": "needs_connection" })

            expect(setup.openDraft).toHaveBeenCalledWith(installationOf(), "vi")
            expect(setup.setGate.mock.calls).toEqual([[OWNER, WS, "s1", "identity", "edit", "Shop"]])
            expect(setup.apply).toHaveBeenCalledWith(OWNER, WS, "i1", "vi")
            expect(readiness.settle).toHaveBeenCalledWith(WS, "i1")
            expect(setup.apply.mock.invocationCallOrder[0] ?? 0).toBeLessThan(
                readiness.settle.mock.invocationCallOrder[0] ?? 0,
            )
        })

        it("applies a first version even when the draft already holds every answer", async () => {
            const { service, setup } = await build()
            setup.openDraft.mockResolvedValue(
                draftOf({ gateEvidence: { identity: confirmed("Shop"), tone: confirmed("warm") } }),
            )

            await service.activate(TARGET, [keptOf()])

            expect(setup.setGate).not.toHaveBeenCalled()
            expect(setup.apply).toHaveBeenCalledWith(OWNER, WS, "i1", "vi")
        })

        it("applies a changed answer again on an installation that already runs on a version", async () => {
            const { service, setup } = await build()
            setup.openDraft.mockResolvedValue(
                draftOf({
                    gateEvidence: { identity: confirmed("Shop"), tone: { status: "proposed", evidence: "warm" } },
                }),
            )

            await service.activate(TARGET, [keptOf(installationOf({ status: "live", activeContextVersionId: "v1" }))])

            expect(setup.setGate.mock.calls).toEqual([[OWNER, WS, "s1", "tone", "edit", "warm"]])
            expect(setup.apply).toHaveBeenCalledTimes(1)
        })
    })
})

describe("SeedActivationService", () => {
    describe("activate on a re-run and on a refusal", () => {
        it("leaves an applied installation as it is when the answers are the same and still settles it", async () => {
            const { service, setup, readiness } = await build()
            setup.openDraft.mockResolvedValue(
                draftOf({ revision: 2, gateEvidence: { identity: confirmed("Shop"), tone: confirmed("warm") } }),
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

describe("SeedActivationService", () => {
    describe("a shop with two agents", () => {
        it("brings both installations to their settled status: the one that is ready runs, the one that waits is not switched on", async () => {
            const { service, setup, readiness, installations } = await build()
            readiness.settle.mockImplementation((_workspaceId, installationId) =>
                Promise.resolve(installationId === "installation-books" ? "needs_connection" : "ready"),
            )
            const kept = ["desk", "books"].map((handle) => ({
                handle,
                installation: installationOf({ id: `installation-${handle}` }),
                answers: ANSWERS,
            }))

            await expect(service.activate(TARGET, kept)).resolves.toEqual({
                desk: "live",
                books: "needs_connection",
            })
            expect(installations.setLive).toHaveBeenCalledTimes(1)
            expect(installations.setLive).toHaveBeenCalledWith(WS, "installation-desk", true, false)
            expect(setup.setGate).toHaveBeenCalledTimes(ANSWERS.length * kept.length)
            expect(setup.apply).toHaveBeenCalledTimes(kept.length)
        })
    })
})
