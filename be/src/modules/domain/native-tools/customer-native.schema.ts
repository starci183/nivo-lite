import { z } from "zod"

/** `customer.brief`: takes no argument, because the conversation is the caller's and never a choice of the model. */
export const CUSTOMER_BRIEF_SCHEMA = z.object({}).strict()

/** The schema the manifest advertises, generated from the validator. */
export const CUSTOMER_BRIEF_INPUT_SCHEMA = z.toJSONSchema(CUSTOMER_BRIEF_SCHEMA, { io: "input" })
