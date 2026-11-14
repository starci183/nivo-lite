import { defineAction, type ActionDefinition } from "@nivo-lite/agent-sdk/block"
import { z } from "zod"
import { MAX_ID } from "../../../bounds"
import { deskRowOfKey } from "../agent-desk"
import { PLATFORM_VIEW } from "../constants"
import { agentDeskPort } from "../ports"
import { refusedWith } from "../refusals"

/** The verdicts a person gives an approval waiting on them. */
export const APPROVAL_VERDICTS = ["approve", "decline"] as const

const input: z.ZodObject<{ id: z.ZodString; command: z.ZodEnum<{ approve: "approve"; decline: "decline" }> }> = z.object({
    id: z.string().min(1).max(MAX_ID),
    command: z.enum(APPROVAL_VERDICTS),
})

/** The refusal of the port that means the row no longer waits here. */
const NOT_WAITING_HERE = "not_waiting_here"

/**
 * `platform.approval-decide`: a person's verdict on an approval of the agent that waits on them, the same answer the /chat card sends:
 * the port hands it to the work engine's own decide door (role, named approver, basis and "no longer waiting" are that door's). It runs
 * with the queue's row key (`deskRowKeyOf`: the installation the row was read under, then the approval's work item) and the command.
 */
export const approvalDecideAction: ActionDefinition = defineAction({
    id: "platform.approval-decide",
    permission: PLATFORM_VIEW,
    label: { vi: "Quy\u1ebft \u0111\u1ecbnh", en: "Decide" },
    input,
    ports: { desk: agentDeskPort },
    transactional: false,
    run: async ({ desk }, { id, command }) => {
        const row = deskRowOfKey(id)
        if (row === null) return refusedWith("not_waiting")
        const answer = await desk.decide(row.installation, { id: row.id, verdict: command })
        if (answer.kind === "decided") return { ok: true }
        return refusedWith(answer.code === NOT_WAITING_HERE ? "not_waiting" : "decide_refused")
    },
    refreshes: ["platform.waiting-on-person", "platform.agent-runs", "platform.agent-today"],
})
