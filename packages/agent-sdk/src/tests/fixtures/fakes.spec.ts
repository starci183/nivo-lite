import {
    sampleActionHandle,
    sampleBlockHost,
    sampleHostRead,
    sampleParamHandle,
    sampleReadHandle,
    sampleSlots,
    sampleWorkbenchHost,
    slotOf,
} from "./fakes"

describe("slotOf", () => {
    it("has the four statuses and a ready builder", () => {
        expect(slotOf.loading).toEqual({ isLoading: true })
        expect(slotOf.forbidden).toEqual({ isForbidden: true })
        expect(slotOf.error).toEqual({ isError: true })
        expect(slotOf.empty).toEqual({ isEmpty: true })
        expect(slotOf.ready([1])).toEqual({ items: [1] })
    })
})

describe("sampleReadHandle and sampleActionHandle", () => {
    it("count retries and record variables", () => {
        const handle = sampleReadHandle(slotOf.ready(1), { q: "a" })
        handle.retry()
        handle.setVariables({ q: "b" })
        expect(handle.retries()).toBe(1)
        expect(handle.variableSets()).toEqual([{ q: "b" }])
        expect(handle.variables).toEqual({ q: "a" })
        expect(handle.page).toBeNull()
    })

    it("record runs and answer with the given outcome", async () => {
        const handle = sampleActionHandle()
        await expect(handle.run({ id: "1" })).resolves.toEqual({ ok: true })
        expect(handle.runs()).toEqual([{ id: "1" }])
        expect(handle).toMatchObject({ isAllowed: true, isRunning: false, label: "" })
        const refused = sampleActionHandle({
            outcome: { ok: false, reason: "failed", message: { key: "k" } },
            isAllowed: false,
            label: "Open",
        })
        await expect(refused.run({ id: "2" })).resolves.toMatchObject({ ok: false })
        expect(refused).toMatchObject({ isAllowed: false, label: "Open" })
    })

    it("sampleSlots hands the handles back as slot values", () => {
        const handle = sampleReadHandle(slotOf.empty)
        expect(sampleSlots({ rows: handle }).rows).toBe(handle)
    })
})

describe("sampleBlockHost", () => {
    it("words keys as themselves and owner text in the locale, and keeps query values, notices and reports", () => {
        const host = sampleBlockHost()
        expect(host.text("ns")({ key: "k" })).toBe("k")
        expect(host.text("ns")({ vi: "a", en: "b" })).toBe("b")
        expect(sampleBlockHost({ locale: () => "vi" }).text("ns")({ vi: "a", en: "b" })).toBe("a")
        expect(host.navigation.href("/x")).toBe("/x")
        host.navigation.setQueryValue("tab", "a")
        expect(host.navigation.queryValue("tab")).toBe("a")
        host.navigation.setQueryValue("tab", null)
        expect(host.navigation.queryValue("tab")).toBeNull()
        host.navigation.setQueryValues({ q: "an", cursor: "c" })
        host.navigation.setQueryValues({ cursor: null })
        expect(host.navigation.queryValue("q")).toBe("an")
        expect(host.navigation.queryValue("cursor")).toBeNull()
        host.notify("danger", "boom")
        host.report("CODE", "at")
        expect(host.notices()).toEqual(["boom"])
        expect(host.reports()).toEqual(["CODE @ at"])
    })
})

describe("sampleParamHandle", () => {
    it("serves the given values, null for the rest, and records the writes", () => {
        const handle = sampleParamHandle({ q: "an", stage: null })
        expect(handle.value("q")).toBe("an")
        expect(handle.value("stage")).toBeNull()
        expect(handle.value("nope")).toBeNull()
        handle.set("q", "b")
        handle.set("q", null)
        expect(handle.writes()).toEqual([
            ["q", "b"],
            ["q", null],
        ])
        expect(sampleParamHandle().value("q")).toBeNull()
    })
})

describe("sampleWorkbenchHost", () => {
    it("serves the reads, actions and permissions it is given", async () => {
        const host = sampleWorkbenchHost({
            reads: { orders: sampleHostRead("ready", [1]) },
            actions: { open: { ok: false, reason: "forbidden", message: { key: "k" } } },
            permissions: ["p"],
        })
        expect(host.useRead("orders", {}).status).toBe("ready")
        expect(host.useRead("orders", null).status).toBe("loading")
        expect(host.useRead("other", {}).status).toBe("loading")
        await expect(host.useAction("open").run({ id: "1" })).resolves.toMatchObject({ ok: false })
        await expect(host.useAction("other").run({ id: "1" })).resolves.toEqual({ ok: true })
        expect(host.useCan(null)).toBe(true)
        expect(host.useCan("p")).toBe(true)
        expect(host.useCan("q")).toBe(false)
        expect(host.useSlotLabels()("nothing")).toMatchObject({ empty: "nothing" })
        const bare = sampleWorkbenchHost()
        expect(bare.useCan("any")).toBe(true)
        expect(bare.useRead("orders", {}).status).toBe("loading")
        await expect(bare.useAction("open").run({ id: "1" })).resolves.toEqual({ ok: true })
        expect(sampleHostRead("loading").reload()).toBeUndefined()
    })
})
