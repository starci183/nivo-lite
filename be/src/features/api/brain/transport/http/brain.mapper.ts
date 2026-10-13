import type { MineResult } from "@modules/domain/brain"
import type { FactRecord, ProposeResult } from "@modules/domain/brain-facts"
import type { LessonRecord } from "@modules/domain/brain-lessons"
import type { DecideFactRequest as DecideFactCommandRequest } from "../../application/decide-fact.contracts"
import type { DecideLessonRequest as DecideLessonCommandRequest } from "../../application/decide-lesson.contracts"
import type { KeepCurrentRequest as KeepCurrentCommandRequest } from "../../application/keep-current.contracts"
import type { SaveFactRequest as SaveFactCommandRequest } from "../../application/save-fact.contracts"
import type { SaveLessonRequest as SaveLessonCommandRequest } from "../../application/save-lesson.contracts"
import type { DecideFactRequest } from "./dto/decide-fact.request"
import type { DecideLessonRequest } from "./dto/decide-lesson.request"
import type { FactResponse, KeptResponse, SavedFactResponse } from "./dto/fact.response"
import type { KeepCurrentRequest } from "./dto/keep-current.request"
import type { LessonResponse, MineResponse } from "./dto/lesson.response"
import type { SaveFactRequest } from "./dto/save-fact.request"
import type { SaveLessonRequest } from "./dto/save-lesson.request"

/** Maps the HTTP request that writes a fact, with the workspace it names, to the command request. */
export const toSaveFactRequest = (workspaceId: string, input: SaveFactRequest): SaveFactCommandRequest => ({
    workspaceId,
    ...input,
})

/** Maps the HTTP request that decides a fact to the command request. */
export const toDecideFactRequest = (
    workspaceId: string,
    id: string,
    input: DecideFactRequest,
): DecideFactCommandRequest => ({ workspaceId, id, ...input })

/** Maps the HTTP request that keeps the value in force to the command request. */
export const toKeepCurrentRequest = (workspaceId: string, input: KeepCurrentRequest): KeepCurrentCommandRequest => ({
    workspaceId,
    ...input,
})

/** Maps the HTTP request that writes a lesson to the command request. */
export const toSaveLessonRequest = (workspaceId: string, input: SaveLessonRequest): SaveLessonCommandRequest => ({
    workspaceId,
    ...input,
})

/** Maps the HTTP request that decides a lesson to the command request. */
export const toDecideLessonRequest = (
    workspaceId: string,
    id: string,
    input: DecideLessonRequest,
): DecideLessonCommandRequest => ({ workspaceId, id, ...input })

/** The fact as the HTTP answer carries it. */
export const toFactResponse = (fact: FactRecord): FactResponse => ({ ...fact })

/** What writing a fact did, as the HTTP answer carries it. */
export const toSavedFactResponse = (result: ProposeResult): SavedFactResponse => ({
    fact: { ...result.fact },
    outcome: result.outcome,
})

/** How many waiting values were rejected, as the HTTP answer carries it. */
export const toKeptResponse = (rejected: number): KeptResponse => ({ rejected })

/** The lesson as the HTTP answer carries it. */
export const toLessonResponse = (lesson: LessonRecord): LessonResponse => ({ ...lesson })

/** What studying the corrections did, as the HTTP answer carries it. */
export const toMineResponse = (result: MineResult): MineResponse => ({ ...result })
