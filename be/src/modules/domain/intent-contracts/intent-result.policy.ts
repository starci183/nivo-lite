import type { IntentResultKind } from "./intent-contracts.contracts"
import { agentRequestSchema, customerReplySchema, ownTurnPickSchema } from "./intent-result.schema"

/** The schemas of the results, by kind: a new kind is one more entry here and one in the table of words of the prompt. */
const INTENT_RESULT_SCHEMAS: Readonly<
    Record<IntentResultKind, typeof customerReplySchema | typeof agentRequestSchema | typeof ownTurnPickSchema>
> = {
    customer_reply: customerReplySchema,
    agent_request: agentRequestSchema,
    own_turn_pick: ownTurnPickSchema,
}

/** The schema a kind of result is read by. */
export const resultSchemaOf = (kind: IntentResultKind): (typeof INTENT_RESULT_SCHEMAS)[IntentResultKind] =>
    INTENT_RESULT_SCHEMAS[kind]
