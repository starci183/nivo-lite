import type { PlanOp } from "./catalog.types"
import { ENTITY_PLAN_DESTRUCTIVE, destructiveOps } from "./plan-problems"

describe("destructiveOps", () => {
    it("names the exit code and keeps the steps that are not additive", () => {
        expect(ENTITY_PLAN_DESTRUCTIVE).toBe("ENTITY_PLAN_DESTRUCTIVE")
        const add: PlanOp = { kind: "create_index", object: "public.t:index:a", additive: true, reason: "r" }
        const drop: PlanOp = { kind: "drop_index", object: "public.t:index:b", additive: false, reason: "r" }
        expect(destructiveOps([add, drop])).toEqual([drop])
        expect(destructiveOps([add])).toEqual([])
    })
})
