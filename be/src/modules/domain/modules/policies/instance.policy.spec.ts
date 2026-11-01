import { Test } from "@nestjs/testing"
import type { DefaultRule } from "@modules/domain/authority-rules"
import type { AuthorityActionDefinition, ModuleDefinition } from "../modules.contracts"
import {
    agentNameOf as realAgentNameOf,
    cleanInstanceName as realCleanInstanceName,
    defaultRulesOf as realDefaultRulesOf,
    freeHandle as realFreeHandle,
    instanceNameKey as realInstanceNameKey,
    nextInstanceName as realNextInstanceName,
    settingOf as realSettingOf,
    withSetting as realWithSetting,
} from "./instance.policy"

const SUBJECT = Symbol("instance.policy")
type Subject = {
    agentNameOf: typeof realAgentNameOf
    cleanInstanceName: typeof realCleanInstanceName
    defaultRulesOf: typeof realDefaultRulesOf
    freeHandle: typeof realFreeHandle
    instanceNameKey: typeof realInstanceNameKey
    nextInstanceName: typeof realNextInstanceName
    settingOf: typeof realSettingOf
    withSetting: typeof realWithSetting
}

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            {
                provide: SUBJECT,
                useValue: {
                    agentNameOf: realAgentNameOf,
                    cleanInstanceName: realCleanInstanceName,
                    defaultRulesOf: realDefaultRulesOf,
                    freeHandle: realFreeHandle,
                    instanceNameKey: realInstanceNameKey,
                    nextInstanceName: realNextInstanceName,
                    settingOf: realSettingOf,
                    withSetting: realWithSetting,
                },
            },
        ],
    }).compile()
    const subject = moduleRef.get<Subject>(SUBJECT)
    return { subject }
}

const text = { vi: "v", en: "e" }
const list = { vi: ["v"], en: ["e"] }

const actionOf = (
    action: string,
    mode: AuthorityActionDefinition["mode"],
    limitVnd: number | null,
): AuthorityActionDefinition => ({
    action,
    label: text,
    mode,
    limitVnd,
    requiredFields: ["lead_id"],
    amountLimit: limitVnd !== null,
    maxMode: null,
    note: "",
    next: [],
})

const moduleOf = (actions: ReadonlyArray<AuthorityActionDefinition>): ModuleDefinition => ({
    key: "demo",
    order: 1,
    name: text,
    shortName: text,
    description: text,
    points: list,
    purpose: "Demo.",
    icon: "bolt",
    glyph: "M0 0",
    mascot: "/m.png",
    category: "ops",
    status: "stable",
    audience: "customer",
    includedWithWorkspace: false,
    available: true,
    knowledgeFolder: "demo",
    workbench: null,
    settingsExtras: null,
    requires: { capabilities: [], connections: [] },
    connectionProviders: [],
    defaultOperatingMode: "assist",
    multiInstance: false,
    agent: { label: text, handle: "demo", summary: text, capabilities: list, role: text, instructions: text },
    gates: [],
    authorityActions: actions,
    accepts: [],
})

describe("instanceNameKey", () => {
    it("compares a trimmed name without case", async () => {
        const { subject } = await buildSubject()

        expect(subject.instanceNameKey("  Shop A  ")).toBe("shop a")
    })
})

describe("cleanInstanceName", () => {
    it("collapses whitespace", async () => {
        const { subject } = await buildSubject()

        expect(subject.cleanInstanceName("  Hue   tea  ")).toBe("Hue tea")
    })

    it("keeps a name of 80 characters", async () => {
        const { subject } = await buildSubject()

        expect(subject.cleanInstanceName("a".repeat(80))).toBe("a".repeat(80))
    })

    it("rejects an empty name", async () => {
        const { subject } = await buildSubject()

        expect(subject.cleanInstanceName("   ")).toBeNull()
    })

    it("rejects a name longer than 80 characters", async () => {
        const { subject } = await buildSubject()

        expect(subject.cleanInstanceName(` ${"a".repeat(81)} `)).toBeNull()
    })
})

describe("nextInstanceName", () => {
    it("uses the type name for the first instance", async () => {
        const { subject } = await buildSubject()

        expect(subject.nextInstanceName("Shop", [])).toBe("Shop")
    })

    it("numbers the next instance after the ones that exist", async () => {
        const { subject } = await buildSubject()

        expect(subject.nextInstanceName("Shop", ["other"])).toBe("Shop 2")
    })

    it("skips a number that is already taken, ignoring case", async () => {
        const { subject } = await buildSubject()

        expect(subject.nextInstanceName("Shop", ["kept", "SHOP 3"])).toBe("Shop 4")
    })

    it("falls back once the search runs out of numbers", async () => {
        const { subject } = await buildSubject()

        const taken = [...Array.from({ length: 997 }, (_, n) => `other-${n}`), "Shop 999"]

        expect(subject.nextInstanceName("Shop", taken)).toBe("Shop 1998")
    })
})

describe("freeHandle", () => {
    it("keeps the base when it is free", async () => {
        const { subject } = await buildSubject()

        expect(subject.freeHandle("mai", new Set<string>())).toBe("mai")
    })

    it("adds the next free number when the base is taken", async () => {
        const { subject } = await buildSubject()

        expect(subject.freeHandle("mai", new Set(["mai", "mai-2"]))).toBe("mai-3")
    })

    it("falls back once every numbered handle is taken", async () => {
        const { subject } = await buildSubject()

        const base = "mai"
        const used = new Set([base, ...Array.from({ length: 1000 }, (_, n) => `${base}-${n + 2}`)])

        expect(subject.freeHandle(base, used)).toBe("mai-2001")
    })
})

describe("agentNameOf", () => {
    it("trims the name and clips it to 40 characters", async () => {
        const { subject } = await buildSubject()

        expect(subject.agentNameOf(`  ${"a".repeat(50)}  `)).toBe("a".repeat(40))
    })
})

describe("defaultRulesOf", () => {
    it("grants one rule per action of the module", async () => {
        const { subject } = await buildSubject()

        const rules: ReadonlyArray<DefaultRule> = [
            { action: "send_quote", mode: "ask", limit_vnd: 1000, required_fields: ["lead_id"] },
            { action: "send_care", mode: "auto", limit_vnd: null, required_fields: ["lead_id"] },
        ]

        expect(
            subject.defaultRulesOf(
                moduleOf([actionOf("send_quote", "ask", 1000), actionOf("send_care", "auto", null)]),
            ),
        ).toEqual(rules)
    })
})

describe("settingOf", () => {
    it("keeps a reply timeout inside 5 to 120 seconds", async () => {
        const { subject } = await buildSubject()

        expect(subject.settingOf("openclawTimeoutSec", 5)).toEqual({ name: "openclawTimeoutSec", value: 5 })
        expect(subject.settingOf("openclawTimeoutSec", "120.4")).toEqual({ name: "openclawTimeoutSec", value: 120 })
    })

    it("rejects a reply timeout outside the range", async () => {
        const { subject } = await buildSubject()

        expect(subject.settingOf("openclawTimeoutSec", 4)).toBeNull()
        expect(subject.settingOf("openclawTimeoutSec", 121)).toBeNull()
        expect(subject.settingOf("openclawTimeoutSec", "nope")).toBeNull()
        expect(subject.settingOf("openclawTimeoutSec", null)).toBeNull()
    })

    it("keeps a holding message, clipped to 400 characters", async () => {
        const { subject } = await buildSubject()

        expect(subject.settingOf("holdingMessage", "  one moment  ")).toEqual({
            name: "holdingMessage",
            value: "one moment",
        })
        expect(subject.settingOf("holdingMessage", "a".repeat(401))).toEqual({
            name: "holdingMessage",
            value: "a".repeat(400),
        })
    })

    it("removes a holding message that is empty", async () => {
        const { subject } = await buildSubject()

        expect(subject.settingOf("holdingMessage", "   ")).toEqual({ name: "holdingMessage", value: null })
    })

    it("rejects a holding message that is not text", async () => {
        const { subject } = await buildSubject()

        expect(subject.settingOf("holdingMessage", 12)).toBeNull()
        expect(subject.settingOf("holdingMessage", null)).toBeNull()
    })

    it("rejects an unknown setting", async () => {
        const { subject } = await buildSubject()

        expect(subject.settingOf("other", "x")).toBeNull()
    })
})

describe("withSetting", () => {
    it("lays the change over the settings and drops a null value", async () => {
        const { subject } = await buildSubject()

        expect(
            subject.withSetting(
                { openclawTimeoutSec: 10, holdingMessage: "hi", other: 1 },
                { name: "holdingMessage", value: null },
            ),
        ).toEqual({ openclawTimeoutSec: 10, other: 1 })
    })

    it("writes a new value", async () => {
        const { subject } = await buildSubject()

        expect(subject.withSetting({ other: 1 }, { name: "openclawTimeoutSec", value: 30 })).toEqual({
            other: 1,
            openclawTimeoutSec: 30,
        })
    })
})
