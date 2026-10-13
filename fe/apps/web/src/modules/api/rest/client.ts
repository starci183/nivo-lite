import axios from "axios"
import { apiUrl } from "@/modules/config"
import { sessionAccessToken } from "@/modules/auth"

/**
 * The one axios instance for the calls that are not GraphQL (uploads, presigned URLs, the public v1 surface). It points at the
 * back end api and carries the Supabase session access token as a bearer.
 */
export const restClient = axios.create({ baseURL: apiUrl(), timeout: 30_000 })

restClient.interceptors.request.use(async (config) => {
    const token = await sessionAccessToken()
    if (token) config.headers.set("Authorization", `Bearer ${token}`)
    return config
})
