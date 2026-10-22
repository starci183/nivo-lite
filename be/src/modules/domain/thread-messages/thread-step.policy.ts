import type { ChainActor, MentionRef, NewChainStep } from "@modules/domain/work-chains"
import type { Locale } from "@modules/platform/i18n"
import type { MentionView } from "./thread-messages.contracts"

/** The thread a step belongs to and the language its texts are written in. */
export interface StepScope {
    /** The workspace. */
    readonly workspaceId: string
    /** The thread. */
    readonly threadId: string
    /** The language of the texts the chain writes. */
    readonly locale: Locale
}

/** The tag a chip stands for, without the name it carries. */
export const refOf = (view: MentionView): MentionRef => ({ kind: view.kind, id: view.id })

/** The chain step a tag makes: the actor handing work to, or assigning work to, whoever the chip names. */
export const tagStepOf = (
    scope: StepScope,
    actor: ChainActor,
    kind: "assign" | "hand_off",
    action: string,
    view: MentionView,
): NewChainStep => ({
    workspaceId: scope.workspaceId,
    threadId: scope.threadId,
    actor,
    kind,
    action,
    detail: "",
    rule: null,
    target: refOf(view),
    approvalRequestId: null,
    locale: scope.locale,
})
