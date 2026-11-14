import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { defineTemplateNode } from "@nivo-lite/agent-sdk/template"
import { z } from "zod"
import { noteNode } from "@tests/fixtures/builders/template-plugin.builder"
import { runDayOf as runDayOfSubject, runIdOfKey as runIdOfKeySubject, runItemOf as runItemOfSubject, splitTemplateBindings as splitTemplateBindingsSubject } from "./template-run.policy"

const SUBJECT = Symbol("template-run.policy")

describe("template-run.policy built the way Nest does", () => {
    let runDayOf: typeof runDayOfSubject
    let runIdOfKey: typeof runIdOfKeySubject
    let runItemOf: typeof runItemOfSubject
    let splitTemplateBindings: typeof splitTemplateBindingsSubject

    beforeAll(async () => {
        const moduleRef = await Test.createTestingModule({
            providers: [{ provide: SUBJECT, useValue: mock<{ runDayOf: typeof runDayOfSubject; runIdOfKey: typeof runIdOfKeySubject; runItemOf: typeof runItemOfSubject; splitTemplateBindings: typeof splitTemplateBindingsSubject }>({ runDayOf: runDayOfSubject, runIdOfKey: runIdOfKeySubject, runItemOf: runItemOfSubject, splitTemplateBindings: splitTemplateBindingsSubject }) }],
        }).compile()
        ;({ runDayOf, runIdOfKey, runItemOf, splitTemplateBindings } = moduleRef.get<{ runDayOf: typeof runDayOfSubject; runIdOfKey: typeof runIdOfKeySubject; runItemOf: typeof runItemOfSubject; splitTemplateBindings: typeof splitTemplateBindingsSubject }>(SUBJECT))
    })

const tuned = defineTemplateNode({
    id: "tmpl.tuned",
    title: { key: "t" },
    description: { vi: "N\u00fat th\u1eed nghi\u1ec7m c\u1ee7a b\u1ed9 ki\u1ec3m tra.", en: "A test node of the checks." },
    tools: [],
    mode: "auto",
    accounts: [],
    input: z.object({ orderId: z.string().max(500) }),
    params: z.object({ tone: z.string().max(500) }),
    output: z.object({}),
    run: () => Promise.resolve({}),
    examples: [{ name: "x", params: { tone: "short" }, input: { orderId: "o1" }, output: {} }],
})

describe("a template node's bindings", () => {
    it("splits the one binding place by the node's params schema; every other member is input", () => {
        expect(splitTemplateBindings(tuned, { orderId: "o1", tone: "short" }, {})).toEqual({
            params: { tone: "short" },
            input: { orderId: "o1" },
        })
        expect(splitTemplateBindings(noteNode, { leadId: "l1" }, { summary: "s" })).toEqual({
            params: {},
            input: { leadId: "l1", summary: "s" },
        })
    })

    it("reads the run id of a run step's key", () => {
        expect(runIdOfKey("run-1:note")).toBe("run-1")
        expect(runIdOfKey("run-1:each[2]")).toBe("run-1")
        expect(runIdOfKey("run-1")).toBe("run-1")
    })
})

describe("the run's day", () => {
    it.each<readonly [string, string, string]>([
        ["2026-11-12T18:30:00.000Z", "Asia/Ho_Chi_Minh", "2026-11-13"],
        ["2026-11-12T16:59:59.000Z", "Asia/Ho_Chi_Minh", "2026-11-12"],
        ["2026-11-12T03:00:00.000Z", "America/Los_Angeles", "2026-11-11"],
        ["2026-01-05T09:00:00.000+07:00", "UTC", "2026-01-05"],
        ["2026-11-12T23:00:00.000Z", "Not/AZone", "2026-11-12"],
    ])("of %s in %s is %s", (at, zone, day) => {
        expect(runDayOf(at, zone)).toBe(day)
    })
})

describe("the run's item", () => {
    it.each([
        { name: "inside a loop", item: { key: "o-7", index: 2 }, expected: { key: "o-7", index: 2 } },
        { name: "outside every loop", item: undefined, expected: null },
    ])("$name: $expected", ({ item, expected }) => {
        expect(runItemOf(item)).toEqual(expected)
    })
})
})
