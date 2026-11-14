import { Test } from "@nestjs/testing"
import { builder, mock } from "@starci/jest-preset"
import type { CallLogRecord } from "@modules/domain/tool-call-log"
import { SEPAY_MANIFEST } from "./adapters/sepay-native.service"
import {
    modeOf,
    toolFamilyOf,
    constraintsOf,
    constraintsOfJson,
    grantOf,
    grantViewOf,
    callLogViewOf,
    NATIVE_TIMEOUT_CEILING_MS,
} from "./tool-rows.mapper"
import type { NativeToolFamily } from "./tools.contracts"

/** The members of the subject under test. */
interface Subject {
    readonly modeOf: typeof modeOf
    readonly toolFamilyOf: typeof toolFamilyOf
    readonly constraintsOf: typeof constraintsOf
    readonly constraintsOfJson: typeof constraintsOfJson
    readonly grantOf: typeof grantOf
    readonly grantViewOf: typeof grantViewOf
    readonly callLogViewOf: typeof callLogViewOf
}

const SUBJECT = Symbol("connector-row.mapper")

/** The mapper functions, read through the Nest testing module. */
const build = async (): Promise<Subject> => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            {
                provide: SUBJECT,
                useValue: {
                    modeOf,
                    toolFamilyOf,
                    constraintsOf,
                    constraintsOfJson,
                    grantOf,
                    grantViewOf,
                    callLogViewOf,
                },
            },
        ],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

const logOf = builder<CallLogRecord>({
    id: "l1",
    tool: "hakuen.rates.quote",
    agent_name: "Sales",
    outcome: "ok",
    error_code: null,
    args_masked: "{}",
    result_summary: "{}",
    duration_ms: 12,
    approved_by: null,
    created_at: "2026-10-20",
})

describe("connector-row.mapper tool families", () => {
    it("runs a tool family at the registry's default limit when its manifest declares none", async () => {
        const { toolFamilyOf } = await build()
        const sepay = mock<NativeToolFamily>({ manifest: SEPAY_MANIFEST })

        expect(toolFamilyOf(sepay, 4000)).toEqual({
            manifest: SEPAY_MANIFEST,
            timeoutMs: 4000,
        })
    })

    it("runs a native connector at the limit its manifest DECLARES (a long synthesis, a compose), up to the engine's ceiling", async () => {
        const { toolFamilyOf } = await build()
        const speech = mock<NativeToolFamily>({ manifest: { ...SEPAY_MANIFEST, key: "speech", timeoutMs: 180_000 } })
        const compose = mock<NativeToolFamily>({ manifest: { ...SEPAY_MANIFEST, key: "compose", timeoutMs: 600_000 } })
        const beyond = mock<NativeToolFamily>({ manifest: { ...SEPAY_MANIFEST, key: "beyond", timeoutMs: 3_600_000 } })
        const tiny = mock<NativeToolFamily>({ manifest: { ...SEPAY_MANIFEST, key: "tiny", timeoutMs: 10 } })

        expect(toolFamilyOf(speech, 4000).timeoutMs).toBe(180_000)
        expect(toolFamilyOf(compose, 4000).timeoutMs).toBe(NATIVE_TIMEOUT_CEILING_MS)
        expect(toolFamilyOf(beyond, 4000).timeoutMs).toBe(NATIVE_TIMEOUT_CEILING_MS)
        expect(toolFamilyOf(tiny, 4000).timeoutMs).toBe(500)
    })
})

describe("connector-row.mapper grants", () => {
    it("reads modes, limits and well-formed constraints", async () => {
        const { grantOf, modeOf } = await build()

        expect(modeOf("ask")).toBe("ask")
        expect(modeOf("x")).toBeNull()
        expect(modeOf("never")).toBeNull()
        expect(grantOf({ tool: "a.b", mode: "never", limit_vnd: null, constraints: [] })).toBeNull()
        expect(
            grantOf({
                tool: "a.b",
                mode: "auto",
                limit_vnd: "1000",
                constraints: [{ arg: "x" }, { arg: "pct", max: 5 }],
            }),
        ).toEqual({ tool: "a.b", mode: "auto", limitVnd: 1000, constraints: [{ arg: "pct", max: 5 }] })
        expect(grantOf({ tool: "a.b", mode: "ask", limit_vnd: "abc", constraints: null })).toEqual({
            tool: "a.b",
            mode: "ask",
            limitVnd: null,
            constraints: [],
        })
        expect(
            grantOf({ tool: "a.b", mode: "ask", limit_vnd: 7, constraints: [3, { arg: "", max: 1 }] })?.limitVnd,
        ).toBe(7)
    })

    it("reads the constraints of a console text; a text that is not a JSON array is refused", async () => {
        const { constraintsOfJson } = await build()

        expect(constraintsOfJson(null)).toEqual([])
        expect(constraintsOfJson(undefined)).toEqual([])
        expect(constraintsOfJson("  ")).toEqual([])
        expect(constraintsOfJson('[{"arg":"discountPct","max":5}]')).toEqual([{ arg: "discountPct", max: 5 }])
        expect(constraintsOfJson('{"arg":"discountPct"}')).toBeNull()
        expect(constraintsOfJson("not json")).toBeNull()
    })

    it("shows a workspace grant with its agent and its constraints as JSON", async () => {
        const { grantViewOf } = await build()

        expect(
            grantViewOf({
                tool: "a.b",
                mode: "ask",
                limit_vnd: null,
                constraints: [{ arg: "discountPct", max: 5 }],
                agent_id: "a",
                agent_name: "Sales",
            }),
        ).toEqual({
            tool: "a.b",
            mode: "ask",
            limitVnd: null,
            constraints: [{ arg: "discountPct", max: 5 }],
            agentId: "a",
            agentName: "Sales",
            constraintsJson: '[{"arg":"discountPct","max":5}]',
        })
    })
})

describe("connector-row.mapper audit", () => {
    it("reads audit rows with an ISO time and a known outcome", async () => {
        const { callLogViewOf } = await build()

        expect(callLogViewOf(logOf({ created_at: new Date("2026-10-20T00:00:00Z") }))).toEqual({
            id: "l1",
            tool: "hakuen.rates.quote",
            agentName: "Sales",
            outcome: "ok",
            errorCode: null,
            argsMasked: "{}",
            resultSummary: "{}",
            durationMs: 12,
            approvedBy: null,
            at: "2026-10-20T00:00:00.000Z",
        })
        expect(callLogViewOf(logOf({ outcome: "zzz" }))).toMatchObject({ outcome: "error", at: "2026-10-20" })
    })
})
