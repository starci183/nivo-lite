import { type NoticeFact, type OutcomeGraphStep, type Ref, type StepUnsuccessful, outcome } from "@nivo-lite/agent-sdk/template"

/**
 * The declined ending of the Sales graphs (R68): a person who declines an approval (a step a shop set to `ask`, the customer mails of
 * MXW-1) made a DECISION. The graph draws no "was it declined" check and no notice for it: the step declares its `unsuccessful` ending,
 * the ENGINE posts the team notice (the workflow, the step's title, the typed reason and the purchase the step was about) and the run
 * ends at the outcome `declined` (outside a loop body) or the step's own exit (inside one).
 */

/** The key and the name of the outcome every declined ending of a Sales graph ends at. */
export const DECLINED_END = "declined"

/** The outcome a declined ending ends at (outside a loop body). */
export const declinedEnd = (): OutcomeGraphStep =>
    outcome({ name: DECLINED_END, label: { vi: "Bị từ chối duyệt", en: "Declined" } })

/** The notice fact naming the purchase the step was about, by its code (the old notice's `ref`). */
export const purchaseFact = (code: Ref<string | null>): NoticeFact => ({ label: { vi: "Mã đơn mua", en: "Purchase" }, value: code })

/** A blocking step outside a loop body: the engine tells the team, the run ends `declined` (as the old notice + outcome did). */
export const endsDeclined = (facts: ReadonlyArray<NoticeFact>): StepUnsuccessful => ({ then: "end", outcome: DECLINED_END, facts })

/** A step inside a loop body: the engine tells the team, the step takes its own exit (the item or round ends as before). */
export const goesOn = (facts: ReadonlyArray<NoticeFact>): StepUnsuccessful => ({ then: "continue", facts })
