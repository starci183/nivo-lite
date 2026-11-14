import { mock } from "@starci/jest-preset"
import type { WorkflowWire } from "@modules/domain/agent-graphs"
import { readinessWireOf, withReadinessOf } from "./workflow-readiness.policy"

/** A workflow of the list, only its id read. */
const workflowOf = (id: string): WorkflowWire => mock<WorkflowWire>({ id })

describe("readinessWireOf", () => {
    it("gives every list, the ones that do not apply empty, and why each provider blocks", () => {
        const blocked = [{ provider: "sepay", reason: "trigger_off" as const }]
        // Ledger (owner key triggerOneSource2026_11_12, CORRECTED 2026-11-12): every block carries `stream` and `connectionIds` (null and
        // empty but for a trigger's `needs_pick`, which names the stream to pick a source for and its accounts).
        expect(readinessWireOf({ hidden: true, waitingFor: ["sepay"], blocked })).toEqual({
            hidden: true,
            waitingFor: ["sepay"],
            skipped: [],
            reconnect: [],
            blocked: [{ provider: "sepay", reason: "trigger_off", stream: null, connectionIds: [], verb: null, tool: null }],
        })
        const stream = "bank-account:VCB:111"
        const verb = "nivo.trigger.payment.credit.received"
        const contested = [
            { provider: "sepay", reason: "needs_pick" as const, stream, connectionIds: ["s1", "c1"], verb },
            { provider: "casso", reason: "needs_pick" as const, stream, connectionIds: ["s1", "c1"], verb },
        ]
        expect(readinessWireOf({ hidden: true, waitingFor: ["sepay", "casso"], blocked: contested }).blocked).toEqual(
            contested.map((block) => ({ ...block, tool: null })),
        )
        // The block carries what the pick drawer submits (`verb`, `stream`, `connectionIds`) and, for an unavailable tool, its name.
        const tool = "nivo.tool.invoice.create"
        expect(
            readinessWireOf({ hidden: true, waitingFor: ["crm"], blocked: [{ provider: "crm", reason: "tool_unavailable", tool }] }).blocked,
        ).toEqual([{ provider: "crm", reason: "tool_unavailable", stream: null, connectionIds: [], verb: null, tool }])
        expect(readinessWireOf({ hidden: false, skipped: ["book"] })).toEqual({
            hidden: false,
            waitingFor: [],
            skipped: ["book"],
            reconnect: [],
            blocked: [],
        })
    })
})

describe("readinessWireOf reconnect", () => {
    it("carries the accounts that need connecting again, for a shown workflow and a hidden one alike, and hides nothing for them", () => {
        const reconnect = [{ provider: "zalo_oa", connectionId: "c-1" }]
        expect(readinessWireOf({ hidden: false, skipped: [], reconnect })).toMatchObject({ hidden: false, blocked: [], reconnect })
        expect(readinessWireOf({ hidden: true, waitingFor: ["sepay"], blocked: [{ provider: "sepay", reason: "trigger_off" as const }], reconnect })).toMatchObject({
            hidden: true,
            reconnect,
        })
    })
})

describe("withReadinessOf", () => {
    it("adds each workflow's readiness, null where it was not read", () => {
        const readiness = new Map([
            [
                "w1",
                {
                    hidden: true as const,
                    waitingFor: ["zalo_oa"],
                    blocked: [{ provider: "zalo_oa", reason: "needs_pick" as const }],
                },
            ],
        ])
        const listed = withReadinessOf([workflowOf("w1"), workflowOf("w2")], readiness)
        expect(listed.map((one) => [one.id, one.readiness])).toEqual([
            [
                "w1",
                {
                    hidden: true,
                    waitingFor: ["zalo_oa"],
                    skipped: [],
                    reconnect: [],
                    blocked: [
                        { provider: "zalo_oa", reason: "needs_pick", stream: null, connectionIds: [], verb: null, tool: null },
                    ],
                },
            ],
            ["w2", null],
        ])
        expect(withReadinessOf([workflowOf("w1")], null).map((one) => one.readiness)).toEqual([null])
    })
})
