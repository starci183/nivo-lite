import {
    recordingActionHandle,
    recordingBlockHost,
    settledHostRead,
    recordingReadHandle,
    slotValuesOf,
    scriptedWorkbenchHost,
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

describe("recordingReadHandle and recordingActionHandle", () => {
    it("count retries and record variables", () => {
        const handle = recordingReadHandle(slotOf.ready(1), { q: "a" })
        handle.retry()
        handle.setVariables({ q: "b" })
        expect(handle.retries()).toBe(1)
        expect(handle.variableSets()).toEqual([{ q: "b" }])
        expect(handle.variables).toEqual({ q: "a" })
        expect(handle.page).toBeNull()
    })

    it("record runs and answer with the given outcome", async () => {
        const handle = recordingActionHandle()
        await expect(handle.run({ id: "1" })).resolves.toEqual({ ok: true })
        expect(handle.runs()).toEqual([{ id: "1" }])
        expect(handle).toMatchObject({ isAllowed: true, isRunning: false, label: "" })
        const refused = recordingActionHandle({
            outcome: { ok: false, reason: "failed", message: { key: "k" } },
            isAllowed: false,
            label: "Open",
        })
        await expect(refused.run({ id: "2" })).resolves.toMatchObject({ ok: false })
        expect(refused).toMatchObject({ isAllowed: false, label: "Open" })
    })

    it("slotValuesOf hands the handles back as slot values", () => {
        const handle = recordingReadHandle(slotOf.empty)
        expect(slotValuesOf({ rows: handle }).rows).toBe(handle)
    })
})

describe("recordingBlockHost", () => {
    it("words keys as themselves and owner text in the locale, and keeps query values, notices and reports", () => {
        const host = recordingBlockHost()
        expect(host.text("ns")({ key: "k" })).toBe("k")
        expect(host.text("ns")({ vi: "a", en: "b" })).toBe("b")
        expect(recordingBlockHost({ locale: () => "vi" }).text("ns")({ vi: "a", en: "b" })).toBe("a")
        expect(host.navigation.href("/x")).toBe("/x")
        host.navigation.setQueryValue("tab", "a")
        expect(host.navigation.queryValue("tab")).toBe("a")
        host.navigation.setQueryValue("tab", null)
        expect(host.navigation.queryValue("tab")).toBeNull()
        host.notify("danger", "boom")
        host.report("CODE", "at")
        expect(host.notices()).toEqual(["boom"])
        expect(host.reports()).toEqual(["CODE @ at"])
    })
})

describe("scriptedWorkbenchHost", () => {
    it("serves the reads, actions and permissions it is given", async () => {
        const host = scriptedWorkbenchHost({
            reads: { orders: settledHostRead("ready", [1]) },
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
        const bare = scriptedWorkbenchHost()
        expect(bare.useCan("any")).toBe(true)
        expect(bare.useRead("orders", {}).status).toBe("loading")
        await expect(bare.useAction("open").run({ id: "1" })).resolves.toEqual({ ok: true })
        expect(settledHostRead("loading").reload()).toBeUndefined()
    })
})
