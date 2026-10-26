import { Test } from "@nestjs/testing"
import { builder, mock } from "@starci/jest-preset"
import { ContextVersionsService } from "@modules/domain/module-context-versions"
import type { ContextVersionRecord, GateEntry } from "@modules/domain/module-context-versions"
import { InstallationRecordsService } from "@modules/domain/module-installations"
import type { InstallationRecord } from "@modules/domain/module-installations"
import { ACCOUNTING_MODULE } from "./accounting.contracts"
import { InstallationDirectoryService } from "./installation-directory.service"
import { ModulesService } from "./modules.service"

const recordOf = builder<InstallationRecord>({
    id: "inst-1",
    workspaceId: "ws-1",
    moduleKey: "accounting",
    name: "Accounting",
    isMulti: false,
    agentId: "agent-1",
    agentName: "Ke toan",
    agentHandle: "ketoan",
    agentAvatarUrl: null,
    status: "live",
    operatingMode: "assist",
    liveEnabled: true,
    activeContextVersionId: "version-1",
    activeVersion: 1,
    settings: { processor: "openclaw" },
    createdAt: "2026-10-01T00:00:00.000Z",
})

const versionOf = builder<ContextVersionRecord>({
    id: "version-1",
    installationId: "inst-1",
    version: 3,
    snapshot: {
        summary: "A bakery in Hanoi.",
        facts: [
            { key: "hours", text: "Open 7 to 21" },
            { key: "vat", text: "VAT 8 percent" },
        ],
        gates: {
            scope: { status: "confirmed", evidence: "Invoices and reminders" },
            currency_tax: { status: "proposed", evidence: "VND, 8 percent" },
            tone: { status: "confirmed", evidence: "Warm and short" },
        },
    },
    appliedBy: "owner-1",
    appliedAt: "2026-10-02T00:00:00.000Z",
})

/** The installation as the agents capability reads it. */
const INSTALLATION = {
    id: "inst-1",
    workspaceId: "ws-1",
    module: "accounting",
    name: "Accounting",
    isMulti: false,
    agentId: "agent-1",
    operatingMode: "assist",
    settings: { processor: "openclaw" },
    activeContextVersionId: "version-1",
    liveEnabled: true,
    removed: false,
}

const build = async () => {
    const installations = mock<InstallationRecordsService>()
    const versions = mock<ContextVersionsService>()
    const catalog = mock<ModulesService>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            InstallationDirectoryService,
            { provide: InstallationRecordsService, useValue: installations },
            { provide: ContextVersionsService, useValue: versions },
            { provide: ModulesService, useValue: catalog },
        ],
    }).compile()
    return { service: moduleRef.get(InstallationDirectoryService), installations, versions, catalog }
}

describe("InstallationDirectoryService > byId, firstOfModule and ofAgent", () => {
    it("maps the installation record to the shape of the agents capability", async () => {
        const { service, installations } = await build()
        installations.find.mockResolvedValue(recordOf())
        installations.firstOfModule.mockResolvedValue(recordOf())
        installations.ofAgent.mockResolvedValue(recordOf())

        await expect(service.byId("ws-1", "inst-1")).resolves.toEqual(INSTALLATION)
        await expect(service.firstOfModule("ws-1", "accounting")).resolves.toEqual(INSTALLATION)
        await expect(service.ofAgent("ws-1", "agent-1")).resolves.toEqual(INSTALLATION)
        expect(installations.find).toHaveBeenCalledWith("ws-1", "inst-1")
    })

    it("marks a removed installation", async () => {
        const { service, installations } = await build()
        installations.find.mockResolvedValue(recordOf({ status: "removed" }))

        await expect(service.byId("ws-1", "inst-1")).resolves.toMatchObject({ removed: true })
    })

    it("answers null when no installation matches", async () => {
        const { service, installations } = await build()
        installations.find.mockResolvedValue(null)
        installations.firstOfModule.mockResolvedValue(null)
        installations.ofAgent.mockResolvedValue(null)

        await expect(service.byId("ws-1", "missing")).resolves.toBeNull()
        await expect(service.firstOfModule("ws-1", "accounting")).resolves.toBeNull()
        await expect(service.ofAgent("ws-1", "agent-9")).resolves.toBeNull()
    })
})

describe("InstallationDirectoryService > onOpenclaw", () => {
    it("answers the installations the records hold", async () => {
        const { service, installations } = await build()
        const refs = [{ id: "inst-1", workspaceId: "ws-1" }]
        installations.onOpenclaw.mockResolvedValue(refs)

        await expect(service.onOpenclaw(null, 10)).resolves.toEqual(refs)
        expect(installations.onOpenclaw).toHaveBeenCalledWith(null, 10)
    })
})

describe("InstallationDirectoryService > contextVersionOf", () => {
    it("answers null for an unknown version", async () => {
        const { service, versions } = await build()
        versions.find.mockResolvedValue(null)

        await expect(service.contextVersionOf("missing")).resolves.toBeNull()
    })

    it("flattens the confirmed gates in the order of the module, the facts and the tone", async () => {
        const { service, versions, installations, catalog } = await build()
        versions.find.mockResolvedValue(versionOf())
        installations.findById.mockResolvedValue(recordOf())
        catalog.find.mockResolvedValue(ACCOUNTING_MODULE)

        await expect(service.contextVersionOf("version-1")).resolves.toEqual({
            version: 3,
            summary: "A bakery in Hanoi.",
            gates: [{ label: ACCOUNTING_MODULE.gates[0]?.label_vi, evidence: "Invoices and reminders" }],
            facts: ["Open 7 to 21", "VAT 8 percent"],
            toneEvidence: "Warm and short",
        })
        expect(catalog.find).toHaveBeenCalledWith("accounting")
    })

    it("keeps empty confirmed evidence and uses catalog order rather than snapshot insertion order", async () => {
        const { service, versions, installations, catalog } = await build()
        versions.find.mockResolvedValue(
            versionOf({
                snapshot: {
                    summary: "Confirmed setup",
                    facts: [],
                    gates: {
                        currency_tax: { status: "confirmed", evidence: "VND" },
                        scope: { status: "confirmed", evidence: "" },
                        source_evidence: { status: "proposed", evidence: "Review invoices" },
                        tone: { status: "confirmed", evidence: "" },
                    },
                },
            }),
        )
        installations.findById.mockResolvedValue(recordOf())
        catalog.find.mockResolvedValue(ACCOUNTING_MODULE)

        await expect(service.contextVersionOf("version-1")).resolves.toEqual({
            version: 3,
            summary: "Confirmed setup",
            gates: [
                { label: ACCOUNTING_MODULE.gates[0]?.label_vi, evidence: "" },
                { label: ACCOUNTING_MODULE.gates[1]?.label_vi, evidence: "VND" },
            ],
            facts: [],
            toneEvidence: "",
        })
        expect(versions.find).toHaveBeenCalledWith("version-1")
        expect(installations.findById).toHaveBeenCalledWith("inst-1")
    })
})

describe("InstallationDirectoryService > contextVersionOf", () => {
    it.each([undefined, null])(
        "keeps empty evidence for a confirmed database gate with %p evidence",
        async (evidence) => {
            const { service, versions, installations, catalog } = await build()
            const scope: GateEntry = { status: "confirmed", evidence: "Placeholder" }
            const version = versionOf({
                snapshot: {
                    summary: "Imported setup",
                    facts: [],
                    gates: { scope },
                },
            })
            if (evidence === undefined) Reflect.deleteProperty(scope, "evidence")
            else Object.defineProperty(scope, "evidence", { value: evidence })
            versions.find.mockResolvedValue(version)
            installations.findById.mockResolvedValue(recordOf())
            catalog.find.mockResolvedValue(ACCOUNTING_MODULE)

            await expect(service.contextVersionOf("version-1")).resolves.toEqual({
                version: 3,
                summary: "Imported setup",
                gates: [{ label: ACCOUNTING_MODULE.gates[0]?.label_vi, evidence: "" }],
                facts: [],
                toneEvidence: "",
            })
        },
    )

    it("lists no gate when the installation is gone, and no tone when none was confirmed", async () => {
        const { service, versions, installations, catalog } = await build()
        versions.find.mockResolvedValue(
            versionOf({
                snapshot: { summary: "", facts: [], gates: { scope: { status: "confirmed", evidence: "" } } },
            }),
        )
        installations.findById.mockResolvedValue(null)

        await expect(service.contextVersionOf("version-1")).resolves.toEqual({
            version: 3,
            summary: "",
            gates: [],
            facts: [],
            toneEvidence: "",
        })
        expect(catalog.find).not.toHaveBeenCalled()
    })
})
