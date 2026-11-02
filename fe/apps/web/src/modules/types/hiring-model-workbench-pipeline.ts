import type { BadgeTone } from "@starci/grammar/common"
import type { HiringOption } from "./hiring-model-workbench-jobs"
import type { HiringRejectFields, HiringRejectActions } from "./hiring-model-workbench-candidate"
/** The original pipeline vocabulary, resolved by the domain projection. */
interface HiringPipelineWords {
    readonly title: string
    readonly jobLabel: string
    readonly moveFailed: string
    readonly dismissLabel: string
    readonly emptyTitle: string
    readonly emptyBody: string
    readonly boardLabel: string
    readonly laneEmpty: string
    readonly openLabel: string
    readonly moveToLabel: string
    readonly movePlaceholder: string
}
/** Resolved pipeline card facts supplied by the connected hiring owner. */
export interface HiringPipelineCard {
    readonly id: string
    readonly name: string
    readonly scoreLabel: string
    readonly scoreTone: BadgeTone
    readonly meta: string
    readonly suggestion: string | null
    readonly moveOptions: ReadonlyArray<HiringOption>
}
/** Resolved pipeline lane facts supplied by the connected hiring owner. */
interface HiringPipelineLane {
    readonly stage: string
    readonly label: string
    readonly count: string
    readonly cards: ReadonlyArray<HiringPipelineCard>
}
/** Resolved pipeline facts supplied by the connected hiring owner. */
export interface HiringPipelineFields {
    readonly copy: HiringPipelineWords
    readonly jobId: string
    readonly jobOptions: ReadonlyArray<HiringOption>
    readonly lanes: ReadonlyArray<HiringPipelineLane>
    readonly hasNoCandidates: boolean
    readonly withdrawnNote: string | null
    readonly dragId: string | null
    readonly overStage: string | null
    readonly isBusy: boolean
    readonly error: string | null
    readonly isRejectOpen: boolean
    readonly reject: HiringRejectFields
}
/** Callbacks for pipeline board interactions, bound by the connected hiring owner. */
export interface HiringPipelineBoardActions {
    readonly job: (id: string) => void
    readonly open: (id: string) => void
    readonly move: (id: string, stage: string) => void
    readonly dragStart: (id: string) => void
    readonly dragEnd: () => void
    readonly dragOver: (stage: string) => void
    readonly dragLeave: (stage: string) => void
    readonly drop: (stage: string, transferId: string) => void
    readonly clearError: () => void
}
/** Callbacks for pipeline interactions, bound by the connected hiring owner. */
export interface HiringPipelineActions {
    readonly board: HiringPipelineBoardActions
    readonly reject: HiringRejectActions
}
