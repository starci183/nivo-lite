import { In, LessThan } from "typeorm"
import { candidateRow, interviewRow } from "./hiring-rows.builder"

/** One candidate row per id, the defaults of the area for the rest. */
export const candidateRowsOf = (ids: ReadonlyArray<string>) => ids.map((id) => candidateRow({ id }))

/** A proposed interview that has no slot yet and no proposed slots. */
export const unslottedInterviewRow = () =>
    interviewRow({ status: "proposed", slotStart: null, slotEnd: null, proposedSlots: null })

/** The find a retention sweep makes for the candidates of a workspace that left the pipeline before `cutoff`, as `namedCalls` reports it. */
export const retentionCandidatesFind = (cutoff: Date) =>
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

/** The find the busy windows of an interviewer make, as `namedCalls` reports it. */
export const busyInterviewsFind = (userId: string) =>
    [
        "HiringInterviewEntity",
        {
            select: { slotStart: true, slotEnd: true, proposedSlots: true, status: true },
            where: { workspaceId: "ws-1", interviewerUserId: userId, status: In(["proposed", "confirmed"]) },
            take: 500,
        },
    ] as const
