import type { Bilingual } from "@nivo-lite/agent-sdk/module"
import { bilingualOf } from "../../../shared/messages/catalog"
import { guidanceOf } from "../../../shared/agent/agent-policy"

/**
 * The craft of the Hiring agent: the words it works under, in the owner's two languages, put in front of every model call of its steps
 * (the plugin's `guidance` function adds the base mindset after them). Its own rules first, then the rules every agent shares.
 */
export const HIRING_GUIDANCE: Bilingual = guidanceOf(bilingualOf("policyHiringGuidance"))
