import { z } from "zod"
import { MAX_ID } from "../../bounds"
import type { HeardLine } from "../../modules/chatbot/service/hear"

/** The longest words of one customer message. */
export const TEXT_MAX = 8000
const FILES_MAX = 20
const URL_MAX = 2000
/** The most events of a run's queue one step reads. */
export const QUEUE_MAX = 50

/** The files of a customer message. */
export type FileList = ReadonlyArray<{ readonly id: string; readonly url: string; readonly name: string; readonly contentType: string }> | null | undefined

/** The files that came with a customer message, as the channel's data holds them (the pictures the shop kept). */
export const fileListSchema: z.ZodType<FileList, FileList> = z
    .array(z.object({ id: z.string().max(MAX_ID), url: z.string().max(URL_MAX), name: z.string().max(MAX_ID), contentType: z.string().max(MAX_ID) }))
    .max(FILES_MAX)
    .nullish()

/** The person a line is from, as the event's subject names them (the trigger scope's `subject`). */
export interface SubjectShape {
    readonly channel: string
    readonly id: string
    readonly name?: string | null | undefined
}

/** The data of a channel message (ROAD-API 3.2): the key the line is kept under, its words, its time, its files; `resume` on the release door's event. */
export interface ChannelData {
    readonly messageKey?: string | null | undefined
    readonly text?: string | undefined
    readonly at?: string | null | undefined
    readonly files?: FileList
    readonly resume?: string | null | undefined
}

/** The schema of the event's subject. */
export const heardSubjectSchema: z.ZodType<SubjectShape, SubjectShape> = z.object({
    channel: z.string().min(1).max(MAX_ID),
    id: z.string().min(1).max(MAX_ID),
    name: z.string().max(MAX_ID).nullish(),
})

/** The schema of a channel message's data. */
export const channelDataSchema: z.ZodType<ChannelData, ChannelData> = z.object({
    messageKey: z.string().max(MAX_ID).nullish(),
    text: z.string().max(TEXT_MAX).optional(),
    at: z.string().max(MAX_ID).nullish(),
    files: fileListSchema,
    resume: z.string().max(MAX_ID).nullish(),
})

/** What a queued event must look like to be a channel customer message: the scope of a channel verb (a subject and the channel data). Shape only. */
const queuedMessageSchema = z.object({ subject: heardSubjectSchema.nullish(), data: channelDataSchema })

/** The customer line of one channel event's scope (its subject and data), or null when it carries none (no message key: the release door's resume). */
export const lineOfScope = (subject: SubjectShape | null | undefined, data: ChannelData): HeardLine | null =>
    data.messageKey === undefined || data.messageKey === null || data.messageKey === ""
        ? null
        : { messageKey: data.messageKey, text: data.text ?? "", at: data.at, files: data.files, subject }

/** The customer lines the events of the run's queue carry, oldest first; an event that is not a channel customer message carries none. */
export const queuedLinesOf = (queue: ReadonlyArray<unknown>): ReadonlyArray<HeardLine> =>
    queue.slice(0, QUEUE_MAX).flatMap((event): ReadonlyArray<HeardLine> => {
        const parsed = queuedMessageSchema.safeParse(event)
        if (!parsed.success) return []
        const line = lineOfScope(parsed.data.subject, parsed.data.data)
        return line === null ? [] : [line]
    })
