import type { GraphTagSource, TriggerCondition, TriggerSource } from "@nivo-lite/agent-sdk/graph"
import type { ProviderKey, TriggerVerb } from "@nivo-lite/agent-sdk/names"
import { conditionsOfSource, roadOfSource, sourcesOfTrigger } from "@modules/domain/trigger-specs"

/**
 * The sources of today one trigger of a @2 graph listens on, from the trigger registry (`TRIGGERS` of trigger-specs, the one table): the
 * sources of the adapter of EACH provider it lists, in the list's order then the adapter's (SePay: the core bank road, then its provider
 * trigger; Casso, PayOS: their provider trigger; Zalo, Telegram, Facebook, Instagram: their channel, each under its own verb; IMAP: its
 * provider trigger); with none listed, the verb's engine road (the website form, the clock, a timer, the team chat, a workflow call). A
 * provider that does not serve the verb gives none, and so does a verb only providers serve when none is listed. The sources name no
 * connection: the workspace's accounts are bound to them at run time, one source per stream (owner key `triggerOneSource2026_11_12`,
 * CORRECTED; `trigger-readiness.policy.ts` `triggerBindingOf`).
 */
export const sourcesOfVerb = (verb: TriggerVerb, accounts: ReadonlyArray<ProviderKey> | undefined): ReadonlyArray<TriggerSource> =>
    sourcesOfTrigger(verb, accounts)

/**
 * The conditions one derived registration of a @2 trigger carries on a source of today: the verb's own meaning on that source, from the
 * trigger registry (`conditionsOfSource`: a bank feed's `transaction.received` keeps the credits, `direction = in`), then the graph's own
 * `where`, as written. A `where` is carried onto EVERY derived source; one naming a member a source does not supply is a save problem
 * (`TRIGGER_CONDITION_UNKNOWN`), never a silent pass.
 */
export const conditionsOfVerbSource = (
    verb: TriggerVerb,
    source: TriggerSource,
    where: ReadonlyArray<TriggerCondition> | undefined,
): ReadonlyArray<TriggerCondition> => [...conditionsOfSource(verb, source), ...(where ?? [])]

/** The road a source of today arrives on, from the trigger registry; null for a kind the registry does not wrap. */
export const wakeOfSource = (source: TriggerSource): GraphTagSource | null => roadOfSource(source)
