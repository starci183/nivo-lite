import { z } from "zod"
import { FILE_KEY_MAX, FILE_NAME_MAX, FILE_REMOTE_URL_MAX } from "@nivo-lite/agent-sdk/entity"
import { QUERY_LIMITS } from "@nivo-lite/agent-sdk/query"
import type { ToolJson } from "@modules/domain/tools"

/** The longest a signed address a file tool issues may live, in seconds: seven days, what the store's signed addresses can carry. */
export const FILE_URL_SECONDS_MAX = 604_800

/**
 * The record type a call works on: a name an installed package declares with `defineEntity`. Only its bounds are checked here; whether
 * an installed package declares it is the tool's to say (`type_unknown`).
 */
const recordType = z
    .string()
    .min(3)
    .max(QUERY_LIMITS.name)
    .describe("The record type, as its package declares it (`blocks-core.video.project`).")

/** A record id as an earlier answer gave it. */
const recordId = z.string().min(1).max(64).describe("The record, by the `id` an earlier answer gave.")

/** A declared `file` field of the type. */
const fileField = z.string().min(1).max(64).describe("The declared file field of the record type (`cover`).")

/** The item of a list file field: the object key of one of its files. */
const itemKey = z.string().min(1).max(FILE_KEY_MAX)

/** The file name to keep. */
const fileName = z.string().min(1).max(FILE_NAME_MAX).describe("The file name to keep and offer on download.")

/** The arguments of `nivo.tool.file.put`: exactly one of `staged` and `url`. */
export const FILE_PUT_SCHEMA = z
    .strictObject({
        type: recordType,
        id: recordId,
        field: fileField,
        staged: z
            .string()
            .min(1)
            .max(FILE_KEY_MAX)
            .optional()
            .describe(
                "The staged file a provider tool answered (`staged`): bytes it produced, kept in your workspace.",
            ),
        url: z
            .string()
            .min(1)
            .max(FILE_REMOTE_URL_MAX)
            .optional()
            .describe(
                "The public https address of a file a provider tool answered (a generated video, a voice): it is fetched once for you.",
            ),
        name: fileName,
        replaces: itemKey
            .optional()
            .describe(
                "A list field only: the `key` of the file this one takes the place of (same position); the old file is removed.",
            ),
    })
    .refine((args) => (args.staged === undefined) !== (args.url === undefined), {
        message: "Give exactly one of `staged` and `url`.",
    })

/** The arguments of `nivo.tool.file.link`. */
export const FILE_LINK_SCHEMA = z.strictObject({
    type: recordType,
    id: recordId,
    field: fileField,
    key: z
        .string()
        .min(1)
        .max(FILE_KEY_MAX)
        .describe(
            "The object to attach: a file already uploaded to this very field of this record, or a staged file of your workspace.",
        ),
    name: fileName,
    replaces: itemKey
        .optional()
        .describe(
            "A list field only: the `key` of the file this one takes the place of (same position); the old file is removed.",
        ),
})

/** The arguments of `nivo.tool.file.get`. */
export const FILE_GET_SCHEMA = z.strictObject({
    type: recordType,
    id: recordId,
    field: fileField,
    key: itemKey
        .optional()
        .describe(
            "A list field only: the `key` of the file to read (each `file` answer carries it); required for a list field.",
        ),
    expiresInSeconds: z
        .number()
        .int()
        .min(1)
        .max(FILE_URL_SECONDS_MAX)
        .optional()
        .describe(
            "How long the address works, in seconds, 1 to 604800 (seven days); one hour when left out. Ask for a long life only to send the file through a channel that keeps it (a chat that caches the picture).",
        ),
})

/** The arguments of `nivo.tool.file.put`, as the tool reads them. */
export type FilePutArgs = z.output<typeof FILE_PUT_SCHEMA>

/** The arguments of `nivo.tool.file.link`, as the tool reads them. */
export type FileLinkArgs = z.output<typeof FILE_LINK_SCHEMA>

/** The arguments of `nivo.tool.file.get`, as the tool reads them. */
export type FileGetArgs = z.output<typeof FILE_GET_SCHEMA>

/** The schemas the manifest announces, generated from the validators. */
export const FILE_PUT_INPUT_SCHEMA: ToolJson = z.toJSONSchema(FILE_PUT_SCHEMA, { io: "input" })
export const FILE_LINK_INPUT_SCHEMA: ToolJson = z.toJSONSchema(FILE_LINK_SCHEMA, { io: "input" })
export const FILE_GET_INPUT_SCHEMA: ToolJson = z.toJSONSchema(FILE_GET_SCHEMA, { io: "input" })
