import { z } from "zod"
import { LIST_ROWS_MAX } from "@modules/platform/database"
import {
    WORKSPACE_THEME_FONTS,
    WORKSPACE_THEME_MODES,
    WORKSPACE_THEME_RADII,
    WORKSPACE_THEME_RANGES,
} from "@modules/domain/workspace-settings"

/**
 * The building blocks of the NIVO data op declarations, each bounded. A bound on an op's OUTPUT is never tighter than the data's own
 * bound: it is the op's own input bound where the op takes one (`limit`, `size`, `first`, a name's length), the length the owning service
 * itself enforces when it stores the value (a contact's name is cut to 200, a tag to 40, at most 20 of them), or the shared
 * `LIST_ROWS_MAX` (the most rows a server-side list read returns). Where a column is plain `text` and nothing bounds it, the bound is a
 * generous ceiling that only keeps an answer finite, and says so.
 */

/** An id: a uuid (36) or an engine key (a step key is bounded at 200 by the ops that take one). */
const ID_MAX = 200

/** A name, title, kind, provider, status or outcome word: the same ceiling as a label in a spec document (500); a contact's name is cut to 200. */
const LABEL_MAX = 500

/** An identity's value (an email address is at most 320, the bound `contact.identity.link` takes). */
const IDENTITY_VALUE_MAX = 320

/** A refusal or explanation the op answers as text: the longest text a person's words may carry through the ops (`stop.answer`: 4000). */
const TEXT_MAX = 4000

/** A JSON Schema as JSON text: a workflow's declared input, which its graph document holds (a generous ceiling, one million characters). */
const SCHEMA_JSON_MAX = 1_000_000

/** A moment as text (RFC 3339 with a fraction and an offset is under 40). */
const MOMENT_MAX = 64

/** The record type of a record (`<package>.<agent>.<domain>`): the bound the ops that name one take. */
const RECORD_TYPE_MAX = 120

/** The tags of one contact and the longest tag: what the contacts service stores. */
const CONTACT_TAGS_MAX = 20
const CONTACT_TAG_MAX = 40

/** The most subjects one page of the truth graph holds (`nivo.tool.brain.search` takes at most this as `limit`). */
const GRAPH_PAGE_SUBJECTS_MAX = 100

/** The most truths one page of the graph can carry: its subjects, each with at most the rows a list read returns. */
export const BRAIN_NODES_MAX: number = GRAPH_PAGE_SUBJECTS_MAX * LIST_ROWS_MAX

/** The most rows an answer lists when its op takes no `limit` (the shared list-read ceiling). */
const ANSWER_ROWS_MAX = LIST_ROWS_MAX

/** A workspace object's id. */
export const uuid: z.ZodUUID = z.uuid()

/** An opaque page cursor as the op answered it. */
export const cursor: z.ZodString = z.string().max(512)

/** The locale a localised answer is written in. */
export const locale: z.ZodEnum<{ vi: "vi"; en: "en" }> = z.enum(["vi", "en"])

/** An id as an op answers it. */
export const idText: z.ZodString = z.string().max(ID_MAX)

/** A word of an answer (a kind, a name, a status, an outcome). */
export const labelText: z.ZodString = z.string().max(LABEL_MAX)

/** A refusal or explanation of an answer. */
export const longText: z.ZodString = z.string().max(TEXT_MAX)

/** A JSON Schema as JSON text (a workflow's declared input): no store bounds it, so a generous ceiling that only keeps an answer finite. */
export const schemaJson: z.ZodString = z.string().max(SCHEMA_JSON_MAX)

/** A moment of an answer. */
const momentText = z.string().max(MOMENT_MAX)

/** A list of at most `max` members of an answer. */
export const rows = <S extends z.ZodType>(member: S, max: number = ANSWER_ROWS_MAX): z.ZodArray<S> => z.array(member).max(max)

/** An object answer whose members are named here; members the op adds later travel as they are. */
export const answer = <S extends z.core.$ZodLooseShape>(shape: S): z.ZodObject<S, z.core.$loose> => z.looseObject(shape)

/** A list member, as the op answers it. */
export const item: z.ZodObject<Record<never, never>, z.core.$loose> = z.looseObject({})

/** A contact identity as the ops answer it. */
type IdentityAnswer = z.ZodObject<
    {
        id: z.ZodString
        kind: z.ZodString
        provider: z.ZodString
        account: z.ZodString
        value: z.ZodString
        verified: z.ZodBoolean
    },
    z.core.$loose
>

const identity: IdentityAnswer = answer({
    id: idText,
    kind: labelText,
    provider: labelText,
    account: labelText,
    value: z.string().max(IDENTITY_VALUE_MAX),
    verified: z.boolean(),
})

/** A contact as the ops answer it. */
type ContactAnswer = z.ZodObject<
    {
        id: z.ZodString
        displayName: z.ZodNullable<z.ZodString>
        tags: z.ZodArray<z.ZodString>
        createdAt: z.ZodString
        updatedAt: z.ZodString
        identities: z.ZodArray<IdentityAnswer>
    },
    z.core.$loose
>

export const contact: ContactAnswer = answer({
    id: idText,
    displayName: labelText.nullable(),
    tags: z.array(z.string().max(CONTACT_TAG_MAX)).max(CONTACT_TAGS_MAX),
    createdAt: momentText,
    updatedAt: momentText,
    identities: rows(identity),
})

/** The members of the record field one file call names. */
type FileTargetShape = { via: z.ZodString; type: z.ZodString; recordId: z.ZodUUID; field: z.ZodString }

/** The record field one file call names: the read or action it is made for (`via`, whose permission grants it) and the field. */
export const fileTarget: FileTargetShape = {
    via: z
        .string()
        .max(120)
        .regex(/^[a-z][a-z0-9-]*\.[a-z][a-zA-Z0-9.-]*$/u)
        .describe("The declared read or action of the module the file is reached through (its permission applies)."),
    type: z
        .string()
        .max(RECORD_TYPE_MAX)
        .regex(/^[a-z][a-z0-9-]*(\.[a-z][a-z0-9-]*){1,3}$/u)
        .describe("The record type."),
    recordId: uuid.describe("The record."),
    field: z
        .string()
        .max(64)
        .regex(/^[a-z][a-zA-Z0-9]{0,63}$/u)
        .describe("The declared file field of the record type."),
}

/** The file of a list field a call names by its object key (a single field needs none). */
export const fileKey: z.ZodOptional<z.ZodString> = z.string().min(1).max(512).optional().describe("The object key of one file of a list field.")

/** An enum member list as `z.enum` types it. */
type ThemeEnum<T extends ReadonlyArray<string>> = z.ZodEnum<z.core.util.ToEnum<T[number]>>

/** The members of the theme parameters. */
type ThemeShape = {
    hue: z.ZodNumber
    chroma: z.ZodNumber
    lightness: z.ZodNumber
    base: z.ZodNumber
    font: ThemeEnum<typeof WORKSPACE_THEME_FONTS>
    radius: ThemeEnum<typeof WORKSPACE_THEME_RADII>
}

/** The six theme parameters of a workspace (the HeroUI theme-builder ones), as the ops take and answer them. */
export const themeShape: ThemeShape = {
    hue: z.number().min(WORKSPACE_THEME_RANGES.hue.min).max(WORKSPACE_THEME_RANGES.hue.max).describe("The accent hue in degrees."),
    chroma: z.number().min(WORKSPACE_THEME_RANGES.chroma.min).max(WORKSPACE_THEME_RANGES.chroma.max).describe("The accent chroma (oklch)."),
    lightness: z
        .number()
        .min(WORKSPACE_THEME_RANGES.lightness.min)
        .max(WORKSPACE_THEME_RANGES.lightness.max)
        .describe("The accent lightness (oklch) as a fraction."),
    base: z.number().min(WORKSPACE_THEME_RANGES.base.min).max(WORKSPACE_THEME_RANGES.base.max).describe("How much the neutrals lean to the hue."),
    font: z.enum(WORKSPACE_THEME_FONTS),
    radius: z.enum(WORKSPACE_THEME_RADII),
}

/** The workspace theme as an op answers it. */
type ThemeAnswer = z.ZodObject<ThemeShape & { mode: z.ZodNullable<ThemeEnum<typeof WORKSPACE_THEME_MODES>> }, z.core.$loose>

export const themeAnswer: ThemeAnswer = z.looseObject({ ...themeShape, mode: z.enum(WORKSPACE_THEME_MODES).nullable() })
