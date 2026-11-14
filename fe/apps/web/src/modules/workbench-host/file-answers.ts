import { z } from "zod"
import type { SignedFileUrl } from "@nivo-lite/agent-sdk/block"
import type { FileRef } from "@nivo-lite/agent-sdk/entity"

/** The ticket the door answers for an upload: PUT the bytes to `url` with `headers` before `expiresAt`, then confirm `key`. */
export interface FileTicket {
    readonly key: string
    readonly url: string
    readonly headers: Readonly<Record<string, string>>
}

const ticketSchema = z.object({ key: z.string(), url: z.string(), headers: z.record(z.string(), z.string()) })

const referenceSchema = z.object({ key: z.string(), mime: z.string(), size: z.number(), name: z.string() })

const signedSchema = z.object({ url: z.string(), expiresAt: z.string() })

/** The ticket of a door answer; a malformed answer is a transport defect and throws. */
export const fileTicketOf = (answer: unknown): FileTicket => ticketSchema.parse(answer)

/** The reference of a door answer (`fileConfirm`, `fileLink`); a malformed answer throws. */
export const fileRefOf = (answer: unknown): FileRef => referenceSchema.parse(answer)

/** The signed address of a door answer (`fileUrl`, which also says the file's name, type and size: the block holds those); a malformed answer throws. */
export const signedFileUrlOf = (answer: unknown): SignedFileUrl => signedSchema.parse(answer)
