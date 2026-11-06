import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import type { InstallationDirectory } from "@modules/domain/agents"
import type { Logger } from "@modules/platform/logging"
import { KnowledgeRecallService, ModuleProfilesService } from "@modules/domain/agent-knowledge"
import { AGENTS_INSTALLATIONS } from "@modules/domain/agents"
import { AuthorityService } from "@modules/domain/authority"
import { HiringPublicService } from "@modules/domain/hiring"
import { ModuleReadinessService } from "@modules/domain/modules"
import { MESSAGE_CATALOG } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { LOGGER } from "@modules/platform/logging"
import {
    RUNTIME_WS,
    runtimeInstallationOf,
    runtimeTurn,
    RUNTIME_BOOKING_REFUSALS,
    RUNTIME_PARTY_SIZE_CASES,
    RUNTIME_READINESS_CASES,
} from "@tests/fixtures/builders/customer-turn-runtime.builder"
import { CustomerTurnRuntimeService } from "./customer-turn-runtime.service"
import { CustomerTurnsLogEvent } from "./customer-turns.log-events"
import { TurnModulesService } from "./turn-modules.service"

const WS = RUNTIME_WS
const catalog = mock<MessageCatalog>({
    get: (key: string, params?: Readonly<Record<string, string | number>>) =>
        params === undefined || Object.keys(params).length === 0 ? key : `${key}${JSON.stringify(params)}`,
})
const turn = runtimeTurn

const build = async () => {
    const modules = mock<TurnModulesService>({ briefs: jest.fn().mockResolvedValue([]) })
    const logger = mock<Logger>({ info: jest.fn(), warn: jest.fn(), error: jest.fn() })
    const installations = mock<InstallationDirectory>({ ofAgent: jest.fn().mockResolvedValue(null) })
    const authority = mock<AuthorityService>({ load: jest.fn().mockResolvedValue(null) })
    const hiring = mock<HiringPublicService>({ chatBrief: jest.fn().mockResolvedValue("") })
    const profiles = mock<ModuleProfilesService>({
        applicationClause: jest.fn().mockReturnValue(""),
        applicationShape: jest.fn().mockReturnValue(""),
        replyContractOf: jest.fn().mockImplementation((_module: string, base: string) => base),
    })
    const recall = mock<KnowledgeRecallService>({
        recall: jest.fn().mockResolvedValue({ brief: "KNOW", passages: [], facts: [] }),
    })
    const readiness = mock<ModuleReadinessService>({ settle: jest.fn().mockResolvedValue("live") })
    const moduleRef = await Test.createTestingModule({
        providers: [
            CustomerTurnRuntimeService,
            { provide: AGENTS_INSTALLATIONS, useValue: installations },
            { provide: MESSAGE_CATALOG, useValue: catalog },
            { provide: LOGGER, useValue: logger },
            { provide: AuthorityService, useValue: authority },
            { provide: KnowledgeRecallService, useValue: recall },
            { provide: HiringPublicService, useValue: hiring },
            { provide: ModuleProfilesService, useValue: profiles },
            { provide: TurnModulesService, useValue: modules },
            { provide: ModuleReadinessService, useValue: readiness },
        ],
    }).compile()
    return {
        runtime: moduleRef.get(CustomerTurnRuntimeService),
        modules,
        logger,
        installations,
        authority,
        hiring,
        profiles,
        recall,
        readiness,
    }
}

describe("CustomerTurnRuntimeService > proposalFrom", () => {
    it("reads the model's text as the proposal", async () => {
        const { runtime } = await build()
        expect(runtime.proposalFrom('{"reply":"50k","needs_human":false}')).toMatchObject({
            reply: "50k",
            needsHuman: false,
        })
    })

    it("never sends an answer that ignored the contract: it becomes a question for a person", async () => {
        const { runtime } = await build()
        expect(runtime.proposalFrom("Sure, it is cheap!")).toMatchObject({
            reply: "conversations.holdingReply",
            needsHuman: true,
            proposedAnswer: "Sure, it is cheap!",
        })
    })
})

describe("CustomerTurnRuntimeService > proposalFrom, the booking request", () => {
    it("preserves the booking request in the proposal's reply-contract detail", async () => {
        const bookingRequest = {
            intent: "reschedule",
            service: "Haircut",
            date: "2026-10-15",
            time: "09:30",
            from: "13:00",
            to: "17:00",
            party_size: 2,
            contact_name: "Lan",
            phone: "0900",
            email: "lan@example.test",
            note: "Window seat",
        }
        const { runtime } = await build()
        const text = JSON.stringify({ reply: "Let me check", needs_human: false, booking_request: bookingRequest })
        expect(runtime.proposalFrom(text)).toEqual({
            reply: "Let me check",
            needsHuman: false,
            reason: "",
            proposedAnswer: "",
            detail: {
                lead: null,
                order: null,
                payment_claim: false,
                knowledge_gap: null,
                application: null,
                loyalty: null,
                booking_request: bookingRequest,
            },
        })
    })

    it.each(RUNTIME_BOOKING_REFUSALS)("omits a $label booking request from the proposal", async ({ value }) => {
        const { runtime } = await build()
        const text = JSON.stringify({ reply: "Let me check", booking_request: value })
        expect(runtime.proposalFrom(text)).toMatchObject({
            reply: "Let me check",
            needsHuman: false,
            detail: { booking_request: null },
        })
    })
})

describe("CustomerTurnRuntimeService > booking requests", () => {
    it.each(RUNTIME_PARTY_SIZE_CASES)(
        "bounds a $label booking party size in the proposal",
        async ({ value, partySize }) => {
            const { runtime } = await build()
            const text = JSON.stringify({
                reply: "Let me check",
                booking_request: { intent: "availability", party_size: value },
            })
            expect(runtime.proposalFrom(text)).toMatchObject({
                detail: {
                    booking_request: {
                        intent: "availability",
                        service: "",
                        date: null,
                        time: null,
                        from: null,
                        to: null,
                        party_size: partySize,
                        contact_name: "",
                        phone: null,
                        email: null,
                        note: null,
                    },
                },
            })
        },
    )

    it("normalizes a short booking hour and clears invalid dates and hours", async () => {
        const { runtime } = await build()
        const text = JSON.stringify({
            reply: "Let me check",
            booking_request: {
                intent: "waitlist",
                date: "2026/10/15",
                time: " 9:05 ",
                from: "24:00",
                to: "09:60",
                phone: "  ",
                email: "",
                note: " ",
            },
        })
        expect(runtime.proposalFrom(text)).toMatchObject({
            detail: {
                booking_request: {
                    intent: "waitlist",
                    date: null,
                    time: "09:05",
                    from: null,
                    to: null,
                    phone: null,
                    email: null,
                    note: null,
                },
            },
        })
    })
})

describe("CustomerTurnRuntimeService > customer-controlled booking text", () => {
    it("trims and bounds the booking request's customer-controlled text", async () => {
        const { runtime } = await build()
        const text = JSON.stringify({
            reply: "Let me check",
            booking_request: {
                intent: "cancel",
                service: ` ${"S".repeat(170)} `,
                date: " 2026-10-15 extra ",
                contact_name: ` ${"N".repeat(130)} `,
                phone: ` ${"1".repeat(50)} `,
                email: ` ${"E".repeat(260)} `,
                note: ` ${"T".repeat(410)} `,
            },
        })
        expect(runtime.proposalFrom(text)).toMatchObject({
            detail: {
                booking_request: {
                    intent: "cancel",
                    service: "S".repeat(160),
                    date: "2026-10-15",
                    contact_name: "N".repeat(120),
                    phone: "1".repeat(40),
                    email: "E".repeat(254),
                    note: "T".repeat(400),
                },
            },
        })
    })
})

describe("CustomerTurnRuntimeService > systemOf", () => {
    it("builds the context from the persona, the authority and every module brief, without the knowledge text", async () => {
        const { runtime, modules } = await build()
        modules.briefs.mockResolvedValueOnce(["BOOKING RULES", "LOYALTY FACTS"])
        const system = await runtime.systemOf(turn)
        expect(modules.briefs).toHaveBeenCalledWith(turn.conversation)
        expect(system.text).not.toContain("KNOW")
        expect(system.text).toContain("BOOKING RULES")
        expect(system.text).toContain("LOYALTY FACTS")
    })

    it("logs unavailable module briefs and still builds the remaining context", async () => {
        const { runtime, modules, logger } = await build()
        const cause = new Error("module facts unavailable")
        modules.briefs.mockRejectedValueOnce(cause)
        await expect(runtime.systemOf(turn)).resolves.toMatchObject({ sources: [] })
        expect(logger.error).toHaveBeenCalledWith(CustomerTurnsLogEvent.ContextPartFailed, cause, {
            workspaceId: WS,
            part: "modules",
        })
    })

    it("leaves out an authority or hiring block that cannot be read and uses the base contract", async () => {
        const { runtime, authority, hiring, profiles, logger } = await build()
        const cause = new Error("authority down")
        authority.load.mockRejectedValue(cause)
        hiring.chatBrief.mockRejectedValue(new Error("hiring down"))
        profiles.replyContractOf.mockReturnValue(null)
        const system = await runtime.systemOf(turn)
        expect(system.text).toContain("bundle.replyContract")
        expect(logger.error).toHaveBeenCalledWith(CustomerTurnsLogEvent.ContextPartFailed, cause, {
            workspaceId: WS,
            part: "authority",
        })
    })
})

describe("CustomerTurnRuntimeService > installationOf", () => {
    it.each(RUNTIME_READINESS_CASES)("answers an installation the readiness settles as %s", async (status, answer) => {
        const { runtime, installations, readiness } = await build()
        const installation = runtimeInstallationOf()
        installations.ofAgent.mockResolvedValue(installation)
        readiness.settle.mockResolvedValueOnce(status)
        await expect(runtime.installationOf(WS, "a1")).resolves.toEqual(
            typeof answer === "string" ? answer : installation,
        )
        expect(readiness.settle).toHaveBeenCalledWith(WS, "inst-1")
    })

    it("does not answer for an installation the owner has not switched on, whatever its status says", async () => {
        const { runtime, installations, readiness } = await build()
        installations.ofAgent.mockResolvedValue({ ...runtimeInstallationOf(), liveEnabled: false })
        readiness.settle.mockResolvedValueOnce("live")
        await expect(runtime.installationOf(WS, "a1")).resolves.toBe("installation_not_running")
    })

    it("does not answer for an installation with no applied context version, whatever its status says", async () => {
        const { runtime, installations, readiness } = await build()
        installations.ofAgent.mockResolvedValue({ ...runtimeInstallationOf(), activeContextVersionId: null })
        readiness.settle.mockResolvedValueOnce("live")
        await expect(runtime.installationOf(WS, "a1")).resolves.toBe("installation_not_running")
    })

    it("asks no readiness for an agent without an installation", async () => {
        const { runtime, readiness } = await build()
        await expect(runtime.installationOf(WS, "a1")).resolves.toBeNull()
        expect(readiness.settle).not.toHaveBeenCalled()
    })
})
