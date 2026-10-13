import type { DefaultRule } from "@modules/domain/authority-rules"
import type { AuthorityActionDefinition, ModuleDefinition } from "../modules.contracts"
import {
    agentNameOf,
    cleanInstanceName,
    defaultRulesOf,
    freeHandle,
    instanceNameKey,
    nextInstanceName,
    settingOf,
    withSetting,
} from "./instance.policy"

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
    agent: { name: "Demo", handle: "demo", summary: text, capabilities: list, role: text, instructions: text },
    gates: [],
    authorityActions: actions,
    accepts: [],
})

describe("instanceNameKey", () => {
    it("compares a trimmed name without case", () => {
        expect(instanceNameKey("  Shop A  ")).toBe("shop a")
    })
})

describe("cleanInstanceName", () => {
    it("collapses whitespace", () => {
        expect(cleanInstanceName("  Hue   tea  ")).toBe("Hue tea")
    })

    it("keeps a name of 80 characters", () => {
        expect(cleanInstanceName("a".repeat(80))).toBe("a".repeat(80))
    })

    it("rejects an empty name", () => {
        expect(cleanInstanceName("   ")).toBeNull()
    })

    it("rejects a name longer than 80 characters", () => {
        expect(cleanInstanceName(` ${"a".repeat(81)} `)).toBeNull()
    })
})

describe("nextInstanceName", () => {
    it("uses the type name for the first instance", () => {
        expect(nextInstanceName("Shop", [])).toBe("Shop")
    })

    it("numbers the next instance after the ones that exist", () => {
        expect(nextInstanceName("Shop", ["other"])).toBe("Shop 2")
    })

    it("skips a number that is already taken, ignoring case", () => {
        expect(nextInstanceName("Shop", ["kept", "SHOP 3"])).toBe("Shop 4")
    })

    it("falls back once the search runs out of numbers", () => {
        const taken = [...Array.from({ length: 997 }, (_, n) => `other-${n}`), "Shop 999"]

        expect(nextInstanceName("Shop", taken)).toBe("Shop 1998")
    })
})

describe("freeHandle", () => {
    it("keeps the base when it is free", () => {
        expect(freeHandle("mai", new Set<string>())).toBe("mai")
    })

    it("adds the next free number when the base is taken", () => {
        expect(freeHandle("mai", new Set(["mai", "mai-2"]))).toBe("mai-3")
    })

    it("falls back once every numbered handle is taken", () => {
        const base = "mai"
        const used = new Set([base, ...Array.from({ length: 1000 }, (_, n) => `${base}-${n + 2}`)])

        expect(freeHandle(base, used)).toBe("mai-2001")
    })
})

describe("agentNameOf", () => {
    it("trims the name and clips it to 40 characters", () => {
        expect(agentNameOf(`  ${"a".repeat(50)}  `)).toBe("a".repeat(40))
    })
})

describe("defaultRulesOf", () => {
    it("grants one rule per action of the module", () => {
        const rules: ReadonlyArray<DefaultRule> = [
            { action: "send_quote", mode: "ask", limit_vnd: 1000, required_fields: ["lead_id"] },
            { action: "send_care", mode: "auto", limit_vnd: null, required_fields: ["lead_id"] },
        ]

        expect(
            defaultRulesOf(moduleOf([actionOf("send_quote", "ask", 1000), actionOf("send_care", "auto", null)])),
        ).toEqual(rules)
    })
})

describe("settingOf", () => {
    it("keeps a reply timeout inside 5 to 120 seconds", () => {
        expect(settingOf("openclawTimeoutSec", 5)).toEqual({ name: "openclawTimeoutSec", value: 5 })
        expect(settingOf("openclawTimeoutSec", "120.4")).toEqual({ name: "openclawTimeoutSec", value: 120 })
    })

    it("rejects a reply timeout outside the range", () => {
        expect(settingOf("openclawTimeoutSec", 4)).toBeNull()
        expect(settingOf("openclawTimeoutSec", 121)).toBeNull()
        expect(settingOf("openclawTimeoutSec", "nope")).toBeNull()
        expect(settingOf("openclawTimeoutSec", null)).toBeNull()
    })

    it("keeps a holding message, clipped to 400 characters", () => {
        expect(settingOf("holdingMessage", "  one moment  ")).toEqual({ name: "holdingMessage", value: "one moment" })
        expect(settingOf("holdingMessage", "a".repeat(401))).toEqual({ name: "holdingMessage", value: "a".repeat(400) })
    })

    it("removes a holding message that is empty", () => {
        expect(settingOf("holdingMessage", "   ")).toEqual({ name: "holdingMessage", value: null })
    })

    it("rejects a holding message that is not text", () => {
        expect(settingOf("holdingMessage", 12)).toBeNull()
        expect(settingOf("holdingMessage", null)).toBeNull()
    })

    it("rejects an unknown setting", () => {
        expect(settingOf("other", "x")).toBeNull()
    })
})

describe("withSetting", () => {
    it("lays the change over the settings and drops a null value", () => {
        expect(
            withSetting(
                { openclawTimeoutSec: 10, holdingMessage: "hi", other: 1 },
                { name: "holdingMessage", value: null },
            ),
        ).toEqual({ openclawTimeoutSec: 10, other: 1 })
    })

    it("writes a new value", () => {
        expect(withSetting({ other: 1 }, { name: "openclawTimeoutSec", value: 30 })).toEqual({
            other: 1,
            openclawTimeoutSec: 30,
        })
    })
})
