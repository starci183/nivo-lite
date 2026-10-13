import type { GetPlatformHealthRequest, GetPlatformHealthResult } from "../../application/get-platform-health.contracts"
import type { GetPlatformHealthResponse } from "./dto/get-platform-health.response"

/** Maps the HTTP request to the application request. */
export const toGetPlatformHealthRequest = (): GetPlatformHealthRequest => ({})

/** Maps the application result to the HTTP response. */
export const toGetPlatformHealthResponse = (result: GetPlatformHealthResult): GetPlatformHealthResponse => result
