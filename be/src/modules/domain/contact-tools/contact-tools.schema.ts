import { z } from "zod"
import { jsonBodySchema } from "@modules/platform/primitives"
import type { ToolJson } from "@modules/domain/tools"
import { lockedArgumentsShape } from "@modules/domain/context-sources"

/** The longest text one identifier, name, tag or fact name takes. */
const ID_MAX = 200
const NAME_MAX = 200
const VALUE_MAX = 320
const TAG_MAX = 40
const TAGS_MAX = 20
const FACTS_MAX = 20

/** A contact id a call may name. */
const contactId = (): z.ZodOptional<z.ZodString> => z.string().min(1).max(ID_MAX).optional()

/**
 * `nivo.tool.contact.get` on the gateway: only the subject members the door fills into every locked read (`lockedArgumentsShape`, ruling
 * R51 item 1): the route and the contact it is scoped by, and the lead (unread here).
 */
export const CONTACT_GET_SCHEMA = z.object(lockedArgumentsShape()).strict()

/** `nivo.tool.contact.search`: an exact identifier (phone, mail) or a name prefix, or a contact by its id. */
export const CONTACT_SEARCH_SCHEMA = z
    .object({
        query: z.string().min(1).max(VALUE_MAX).optional(),
        contactId: contactId(),
        limit: z.number().int().min(1).max(20).optional(),
    })
    .strict()

/** `nivo.tool.contact.update`: the display name and / or the tags of the contact (the run's own when none is named). */
export const CONTACT_UPDATE_SCHEMA = z
    .object({
        contactId: contactId(),
        displayName: z.string().min(1).max(NAME_MAX).nullable().optional(),
        tags: z.array(z.string().min(1).max(TAG_MAX)).max(TAGS_MAX).optional(),
    })
    .strict()

/** `nivo.tool.contact.memory.remember`: facts about the contact (the run's own when none is named). */
export const CONTACT_REMEMBER_SCHEMA = z
    .object({
        contactId: contactId(),
        facts: z.record(z.string().min(1).max(60), jsonBodySchema).refine((facts) => Object.keys(facts).length <= FACTS_MAX),
    })
    .strict()

/** `nivo.tool.contact.identity.link`: an identity for the contact (the run's own when none is named), or a link token it presents. */
export const CONTACT_LINK_SCHEMA = z
    .object({
        contactId: contactId(),
        kind: z.enum(["phone", "email", "external"]).optional(),
        value: z.string().min(1).max(VALUE_MAX).optional(),
        account: z.uuid().optional(),
        token: z.string().min(8).max(200).optional(),
    })
    .strict()

/** `nivo.tool.contact.merge`: the contact that takes the other over, and the one that goes. */
export const CONTACT_MERGE_SCHEMA = z
    .object({
        intoContactId: z.string().min(1).max(ID_MAX),
        fromContactId: z.string().min(1).max(ID_MAX),
    })
    .strict()

/** What the model may say for a get: nothing (the door fills the run's own contact). */
export const CONTACT_GET_INPUT_SCHEMA: ToolJson = z.toJSONSchema(z.object({}).strict(), { io: "input" })
export const CONTACT_SEARCH_INPUT_SCHEMA: ToolJson = z.toJSONSchema(CONTACT_SEARCH_SCHEMA, { io: "input" })
export const CONTACT_UPDATE_INPUT_SCHEMA: ToolJson = z.toJSONSchema(CONTACT_UPDATE_SCHEMA, { io: "input" })
export const CONTACT_REMEMBER_INPUT_SCHEMA: ToolJson = z.toJSONSchema(CONTACT_REMEMBER_SCHEMA, { io: "input" })
export const CONTACT_LINK_INPUT_SCHEMA: ToolJson = z.toJSONSchema(CONTACT_LINK_SCHEMA, { io: "input" })
export const CONTACT_MERGE_INPUT_SCHEMA: ToolJson = z.toJSONSchema(CONTACT_MERGE_SCHEMA, { io: "input" })
