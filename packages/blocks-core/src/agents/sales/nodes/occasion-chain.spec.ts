import type { JsonObject } from "@nivo-lite/agent-sdk/schema"
import { templateExampleMismatches } from "@nivo-lite/agent-sdk/template"
import { TOOL } from "@nivo-lite/agent-sdk/names"
import { leadCareOf } from "../tools/lead-care.policy"
import { answered } from "../../../shared/nodes/tool-answers"
import { salesCarePlanOccasionsNode } from "./care-plan-occasions.node"
import { salesConsultTurnNode } from "./consult-turn.node"
import { salesOccasionKeepNode } from "./occasion-keep.node"

// D-MX-6 (live B-BUY / H3, 2026-11-11): the customer's "by the way, sister Lan's birthday is on 21/11" was heard by the consult but never
// written (the step had no lead update), so the care plan on payment armed `occasions: 0`. The sales half of the chain, each link real:
// the consult hands the date it heard on in its output -> the occasion keep writes it with `nivo.tool.contact.memory.remember` -> the
// care read of the facts the engine's memory holds after that write (`nivo.tool.lead.care.get`, `leadCareOf`) -> the occasion plan arms
// the reminder a week before. Moved from the engine's lead-memory policy spec, which keeps the engine half (the memory layering and the
// tool's own payload schema); the facts of step 3 are what that layering gives, stated here as the memory holds them.

const OCCASION_LEAD = "lead-1"
const LAN = { label: "sinh nh\u1eadt ch\u1ecb Lan", date: "11-21" }
const MOM = { label: "sinh nh\u1eadt m\u1eb9", date: "03-08" }
/** Noon on the day of the walk (2026-11-11, Vietnam): 21 November is ten days on, so its reminder (seven days before) is ahead. */
const OCCASION_NOW = new Date("2026-11-11T05:00:00.000Z")

/** The consult's own worked example of a date heard on the way (D-MX-6): the one the package proves the consult on. */
const consultHearing = () => {
    const example = salesConsultTurnNode.examples.find((one) => one.name.includes("D-MX-6"))
    expect(example).toBeDefined()
    return example
}

describe("an occasion the customer mentions reaches the care plan (D-MX-6)", () => {
    it("LIVE B-BUY: the consult hands 21/11 on, the keep writes it, the earlier date stays, and the care plan arms its reminder", async () => {
        // 1. The consult step: the date heard on the way rides on its output, for the step that keeps it.
        const hearing = consultHearing()
        if (hearing === undefined) return
        expect(await templateExampleMismatches(salesConsultTurnNode, hearing)).toEqual([])
        // What the consult hands on is what the next steps are given: the walk's date, 21/11.
        const said = (hearing.output?.occasions ?? []).map(({ label, date }) => ({ label, date }))
        expect(said.map((one) => one.date)).toEqual([LAN.date])

        // 2. The keep writes the date with the contact memory write, exactly this payload.
        const payload = { facts: { occasions: said } }
        expect(
            await templateExampleMismatches(salesOccasionKeepNode, {
                name: "keeps the date the consult heard",
                params: {},
                input: { contactId: OCCASION_LEAD, occasions: said },
                tools: [{ id: TOOL.contactMemoryRemember, args: payload, answer: answered({ leadId: OCCASION_LEAD }) }],
                output: { kept: 1, declined: false },
            }),
        ).toEqual([])

        // 3. The facts the memory holds once the write is laid over a memory that already held her mother's birthday: both are kept.
        const kept = { occasions: [MOM, ...said] }

        // 4. The care read of that entry, and the occasion plan arming the reminder seven days before 21/11 (Vietnam midnight). Only
        // 21/11 is armed now: the March date is beyond the horizon the plan arms ahead (it is armed by a later plan).
        const care = leadCareOf(OCCASION_LEAD, kept)
        const lan = care.occasions.find((one) => one.month === 11 && one.day === 21)
        expect(care.occasions.map((one) => one.label)).toEqual([MOM.label, ...said.map((one) => one.label)])
        const read: JsonObject = JSON.parse(JSON.stringify(care))
        expect(
            await templateExampleMismatches(salesCarePlanOccasionsNode, {
                name: "arms the reminder of the date the customer mentioned",
                params: { occasionLeadDays: 7 },
                at: OCCASION_NOW.toISOString(),
                input: { leadId: OCCASION_LEAD },
                tools: [
                    { id: TOOL.leadCareGet, args: { leadId: OCCASION_LEAD }, answer: answered(read) },
                    // Ledger (TOOLS-LEAD F2): the care plan arms through the engine's generic timer (`nivo.tool.timer.arm`: the key `occasion:<item>`,
                    // the kind / record / item in its open `data`), no more through `nivo.tool.lead.care.schedule` (ACCOUNT-DATA's sales recomposition).
                    {
                        id: TOOL.timerArm,
                        args: {
                            ref: `occasion:${lan?.occasionId ?? ""}`,
                            dueAt: "2026-11-13T17:00:00.000Z",
                            data: { kind: "occasion", record: OCCASION_LEAD, item: lan?.occasionId ?? "" },
                        },
                        answer: answered({ armed: true }),
                    },
                ],
                output: { leadId: OCCASION_LEAD, armed: 1, declined: false },
            }),
        ).toEqual([])
    })
})
