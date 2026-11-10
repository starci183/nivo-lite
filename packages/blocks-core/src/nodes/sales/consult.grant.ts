import type { RightsGrant } from "@nivo-lite/agent-sdk/rights"
import { coreEffects } from "../../vocabulary/effects"

/**
 * The grant a worked example of a consult step runs under: the step's own rights plus the rights of the effects its agent may call, as the
 * workflow's grant holds them.
 */
export const exampleGrantOf = (rights: RightsGrant["rights"], effects: ReadonlyArray<string>): RightsGrant => ({
    rights: [
        ...rights,
        ...coreEffects.filter((effect) => effects.includes(effect.id)).flatMap((effect) => effect.rights),
    ],
})
