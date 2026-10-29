import axios from "axios"
import type { AxiosResponse } from "axios"
import { apiOrigin } from "@/modules/config"

/** What a door answered. A refusal is an answer, not a throw: the status says what happened. */
export interface AuthDoorAnswer {
    readonly status: number
    readonly body: unknown
}

/** The cookie header to forward (server side only: the browser sends its own cookies). */
export interface AuthDoorCookie {
    readonly cookie?: string | undefined
}

const answerOf = (response: AxiosResponse<unknown>): AuthDoorAnswer => ({
    status: response.status,
    body: response.data,
})

const optionsOf = ({ cookie }: AuthDoorCookie = {}) => ({
    withCredentials: true,
    validateStatus: () => true,
    ...(cookie === undefined ? {} : { headers: { cookie } }),
})

/** `POST /auth/login`: signs in and sets the httpOnly refresh cookie. A transport failure rejects. */
export const loginDoor = async (body: object): Promise<AuthDoorAnswer> =>
    answerOf(await axios.post<unknown>(`${apiOrigin()}/auth/login`, body, optionsOf()))

/** `POST /auth/signup`: creates an unconfirmed account (answers 202). */
export const signupDoor = async (body: object): Promise<AuthDoorAnswer> =>
    answerOf(await axios.post<unknown>(`${apiOrigin()}/auth/signup`, body, optionsOf()))

/** `POST /auth/resend`: mails the confirmation link again. */
export const resendDoor = async (body: object): Promise<AuthDoorAnswer> =>
    answerOf(await axios.post<unknown>(`${apiOrigin()}/auth/resend`, body, optionsOf()))

/** `POST /auth/confirm`: spends a confirmation link. */
export const confirmDoor = async (body: object): Promise<AuthDoorAnswer> =>
    answerOf(await axios.post<unknown>(`${apiOrigin()}/auth/confirm`, body, optionsOf()))

/** `POST /auth/refresh`: rotates the refresh cookie and answers a new access token. */
export const refreshDoor = async (): Promise<AuthDoorAnswer> =>
    answerOf(await axios.post<unknown>(`${apiOrigin()}/auth/refresh`, {}, optionsOf()))

/** `POST /auth/logout`: ends the session of the cookie and clears it. */
export const logoutDoor = async (): Promise<AuthDoorAnswer> =>
    answerOf(await axios.post<unknown>(`${apiOrigin()}/auth/logout`, {}, optionsOf()))

/** `POST /auth/forgot`: mails a password-reset link. */
export const forgotDoor = async (body: object): Promise<AuthDoorAnswer> =>
    answerOf(await axios.post<unknown>(`${apiOrigin()}/auth/forgot`, body, optionsOf()))

/** `POST /auth/reset`: spends a reset link and sets the new password. */
export const resetDoor = async (body: object): Promise<AuthDoorAnswer> =>
    answerOf(await axios.post<unknown>(`${apiOrigin()}/auth/reset`, body, optionsOf()))

/** `GET /auth/session`: answers a fresh access token for the cookie session WITHOUT rotating the cookie. */
export const sessionDoor = async (request: AuthDoorCookie = {}): Promise<AuthDoorAnswer> =>
    answerOf(await axios.get<unknown>(`${apiOrigin()}/auth/session`, optionsOf(request)))
