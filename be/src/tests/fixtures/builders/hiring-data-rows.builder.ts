import {
    candidateRow,
    interviewRow,
    type HiringCandidateEntity,
    type HiringInterviewEntity,
} from "./hiring-rows.builder"
import { In, LessThan, type FindOperator } from "typeorm"

/** One candidate row per id, the defaults of the area for the rest. */
export const candidateRowsOf = (ids: ReadonlyArray<string>): Array<HiringCandidateEntity> =>
    ids.map((id) => candidateRow({ id }))

/** A proposed interview that has no slot yet and no proposed slots. */
export const unslottedInterviewRow = (): HiringInterviewEntity =>
    interviewRow({ status: "proposed", slotStart: null, slotEnd: null, proposedSlots: null })

type RetentionCandidatesFindResultOrderShape = {
    readonly stageChangedAt: "ASC"
}

type RetentionCandidatesFindResultWhereShape = {
    readonly workspaceId: "ws-1"
    readonly stage: FindOperator<unknown>
    readonly stageChangedAt: FindOperator<Date>
}

type RetentionCandidatesFindResultSelectShape = {
    readonly id: true
}

type RetentionCandidatesFindResultShape = {
    readonly select: RetentionCandidatesFindResultSelectShape
    readonly where: RetentionCandidatesFindResultWhereShape
    readonly order: RetentionCandidatesFindResultOrderShape
    readonly take: 200
}

/** The find a retention sweep makes for the candidates of a workspace that left the pipeline before `cutoff`, as `namedCalls` reports it. */
export const retentionCandidatesFind = (
    cutoff: Date,
): readonly ["HiringCandidateEntity", RetentionCandidatesFindResultShape] =>
    [
        "HiringCandidateEntity",
        {
            select: { id: true },
            where: {
                workspaceId: "ws-1",
                stage: In(["rejected", "withdrawn"]),
                stageChangedAt: LessThan(cutoff),
            },
            order: { stageChangedAt: "ASC" },
            take: 200,
        },
    ] as const

type BusyInterviewsFindResultWhereShape = {
    readonly workspaceId: "ws-1"
    readonly interviewerUserId: string
    readonly status: FindOperator<unknown>
}

type BusyInterviewsFindResultSelectShape = {
    readonly slotStart: true
    readonly slotEnd: true
    readonly proposedSlots: true
    readonly status: true
}

type BusyInterviewsFindResultShape = {
    readonly select: BusyInterviewsFindResultSelectShape
    readonly where: BusyInterviewsFindResultWhereShape
    readonly take: 500
}

/** The find the busy windows of an interviewer make, as `namedCalls` reports it. */
export const busyInterviewsFind = (userId: string): readonly ["HiringInterviewEntity", BusyInterviewsFindResultShape] =>
    [
        "HiringInterviewEntity",
        {
            select: { slotStart: true, slotEnd: true, proposedSlots: true, status: true },
            where: { workspaceId: "ws-1", interviewerUserId: userId, status: In(["proposed", "confirmed"]) },
            take: 500,
        },
    ] as const
