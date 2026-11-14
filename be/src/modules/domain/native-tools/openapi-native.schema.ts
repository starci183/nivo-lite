import { z } from "zod"
import type { ToolJson } from "@modules/domain/tools"
import { isRecord } from "@modules/platform/primitives"

/**
 * The gateway validator of every tool an OpenAPI connector serves: a JSON object. The gateway has already bounded the tree; the
 * plugin's own validator of the tool and the document's schemas of its operation are applied by the connector on every call.
 */
export const OPENAPI_ARGUMENTS_SCHEMA: z.ZodType<ToolJson> = z.custom<ToolJson>((value) => isRecord(value))
