import { defineAction, type ActionDefinition } from "@nivo-lite/agent-sdk/block"
import { z } from "zod"
import { MAX_ID } from "../../../bounds"
import { PLATFORM_VIEW } from "../constants"
import { membersPort, parkedRunsPort, rightsPort } from "../ports"
import { refusedWith } from "../refusals"

const input: z.ZodObject<{ id: z.ZodString }> = z.object({ id: z.string().min(1).max(MAX_ID) })

/**
 * `platform.resume-run`: asks the engine to resume a parked run. It does no business: the engine owns retry and resume. The member
 * who acts must be an owner or a manager, or hold the manage permission of the module the run works for (`<module>.manage`); a run
 * that is gone or no longer parked is refused as data.
 */
export const resumeRunAction: ActionDefinition = defineAction({
    id: "platform.resume-run",
    permission: PLATFORM_VIEW,
    label: { key: "action_resume_run" },
    input,
    ports: { runs: parkedRunsPort, members: membersPort, rights: rightsPort },
    transactional: false,
    run: async ({ runs, members, rights }, { id }, context) => {
        const standing = await runs.find(id)
        if (standing === null) return refusedWith("missing")
        const member = context.memberId === null ? null : await members.get(context.memberId)
        const allowed =
            member?.isManager === true || (await rights.holds(context.memberId, `${standing.module}.manage`))
        if (!allowed) return refusedWith("forbidden")
        if (!standing.parked) return refusedWith("not_parked")
        return (await runs.resume(id)) ? { ok: true } : refusedWith("not_parked")
    },
    refreshes: ["platform.parked-runs"],
})
