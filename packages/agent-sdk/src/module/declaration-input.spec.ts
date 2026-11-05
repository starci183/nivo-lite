import { z } from "zod"
import { defineAction } from "../block/block"
import { actionInputOf, readVariablesOf } from "./declaration-input"
import { LEADS } from "./declaration.fixture"

const MOVE = defineAction({
    id: "sales.move-stage",
    permission: "sales.manage",
    label: { key: "move" },
    input: z.object({ id: z.string().max(40), stage: z.enum(["new", "won"]) }),
    ports: {},
    run: () => Promise.resolve({ ok: true }),
    refreshes: [],
})

describe("readVariablesOf", () => {
    it("returns the parsed variables of a request", () => {
        expect(readVariablesOf(LEADS, { q: "an", stage: "won" })).toEqual({
            ok: true,
            variables: { q: "an", stage: "won" },
        })
    })

    it("refuses a value outside the declared values and a key the read does not declare", () => {
        expect(readVariablesOf(LEADS, { stage: "lost", owner: "x" })).toEqual({
            ok: false,
            problems: [
                { code: "INPUT_UNKNOWN_KEY", at: "owner" },
                { code: "INPUT_INVALID", at: "stage" },
            ],
        })
    })
})

describe("actionInputOf", () => {
    it("returns the parsed payload of a request", () => {
        expect(actionInputOf(MOVE, { id: "l1", stage: "won" })).toEqual({ ok: true, input: { id: "l1", stage: "won" } })
    })

    it("refuses a payload that breaks the input schema, with the unknown key named", () => {
        expect(actionInputOf(MOVE, { id: "l1", stage: "lost", force: true })).toEqual({
            ok: false,
            problems: [
                { code: "INPUT_UNKNOWN_KEY", at: "force" },
                { code: "INPUT_INVALID", at: "stage" },
            ],
        })
    })

    it("refuses every payload of an action that declares no input", () => {
        const hostAction = defineAction({ id: "sales.open", operation: "open", permission: "p", label: { key: "o" } })
        expect(actionInputOf(hostAction, {})).toEqual({ ok: false, problems: [{ code: "INPUT_INVALID", at: "." }] })
    })
})
