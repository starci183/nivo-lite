import { Test } from "@nestjs/testing"
import { planBindingVerdict } from "./plan-binding.policy"

const SUBJECT = Symbol("plan-binding.policy")

const bound = { versionId: "v-1", trigger: "tag" }
const asked = { versionId: "v-1", trigger: "tag" }

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { planBindingVerdict } }],
    }).compile()
    return moduleRef.get<{ planBindingVerdict: typeof planBindingVerdict }>(SUBJECT)
}

describe("planBindingVerdict", () => {
    it("says bound for a run bound to exactly this version and trigger, and unbound for one that carries nothing or this version", async () => {
        const subject = await build()
        expect(subject.planBindingVerdict({ binding: bound, graphVersionId: "v-1", ...asked })).toBe("bound")
        expect(subject.planBindingVerdict({ binding: undefined, graphVersionId: null, ...asked })).toBe("unbound")
        expect(subject.planBindingVerdict({ binding: undefined, graphVersionId: "v-1", ...asked })).toBe("unbound")
    })

    it.each([
        ["another version on the run", bound, "v-2"],
        ["a malformed binding", "broken", "v-1"],
        ["a binding of another version", { versionId: "v-2", trigger: "tag" }, "v-1"],
        ["a binding of another trigger", { versionId: "v-1", trigger: "other" }, "v-1"],
        ["an unbound run on another version", undefined, "v-2"],
    ])("says conflict for %s", async (_name, binding, graphVersionId) => {
        const subject = await build()
        expect(subject.planBindingVerdict({ binding, graphVersionId, ...asked })).toBe("conflict")
    })
})
