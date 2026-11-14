import { FILE_REMOTE_URL_MAX } from "@nivo-lite/agent-sdk/entity"
import { z } from "zod"
import type { RenderCompletedData, RenderRowValue } from "./video-render.trigger"
import { RENDER_ID_MAX } from "./video-compose.schema"

/** The longest provider words a render row keeps (the row's own `error` bound, video-render-data.policy.ts). */
const ERROR_MAX = 2000

/** The longest compose provider name a render row keeps (the row's own `provider` bound). */
const PROVIDER_MAX = 40

/** The longest render status a row keeps (`done` / `failed`, the row's own bound). */
const STATUS_MAX = 6

/** The data schema of a finished render. */
export const RENDER_COMPLETED_DATA: z.ZodType<RenderCompletedData> = z.object({
    renderId: z.string().min(1).max(RENDER_ID_MAX),
    status: z.enum(["done", "failed"]),
    outputUrl: z.string().max(FILE_REMOTE_URL_MAX).optional(),
    error: z.string().max(ERROR_MAX).optional(),
    provider: z.string().min(1).max(PROVIDER_MAX),
})

/** The raw schema: the stored render row value (video-render-data.policy.ts `RenderRow`). */
export const RENDER_ROW: z.ZodType<RenderRowValue> = z.object({
    renderId: z.string().max(RENDER_ID_MAX),
    status: z.string().max(STATUS_MAX),
    outputUrl: z.string().max(FILE_REMOTE_URL_MAX).optional(),
    error: z.string().max(ERROR_MAX).optional(),
    provider: z.string().max(PROVIDER_MAX),
})
