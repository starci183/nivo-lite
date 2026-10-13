import type { ConnectTelegramRequest, ConnectTelegramResult } from "../../application/connect-telegram.contracts"
import type { ConnectTelegramBody } from "./dto/connect-telegram.request"
import type { ConnectTelegramResponse } from "./dto/connect-telegram.response"
import type { StartMoneyRequest, StartMoneyResult } from "../../application/start-money.contracts"
import type { StartMoneyBody } from "./dto/start-money.request"
import type { StartMoneyResponse } from "./dto/start-money.response"
import type { UpdateMoneyRequest, UpdateMoneyResult } from "../../application/update-money.contracts"
import type { UpdateMoneyBody } from "./dto/update-money.request"
import type { UpdateMoneyResponse } from "./dto/update-money.response"
import type { ResumeConnectionRequest, ResumeConnectionResult } from "../../application/resume-connection.contracts"
import type { ResumeConnectionResponse } from "./dto/resume-connection.response"
import type { RevealSepayKeyRequest, RevealSepayKeyResult } from "../../application/reveal-sepay-key.contracts"
import type { RevealSepayKeyResponse } from "./dto/reveal-sepay-key.response"
import type { SaveProviderKeysRequest, SaveProviderKeysResult } from "../../application/save-provider-keys.contracts"
import type { SaveProviderKeysBody } from "./dto/save-provider-keys.request"
import type { SaveProviderKeysResponse } from "./dto/save-provider-keys.response"
import type { StartZaloRequest, StartZaloResult } from "../../application/start-zalo.contracts"
import type { StartZaloBody } from "./dto/start-zalo.request"
import type { StartZaloResponse } from "./dto/start-zalo.response"
import type { ResumeZaloRequest, ResumeZaloResult } from "../../application/resume-zalo.contracts"
import type { ResumeZaloResponse } from "./dto/resume-zalo.response"
import type { SaveZaloOaSecretRequest } from "../../application/save-zalo-oa-secret.contracts"
import type { SaveZaloOaSecretBody } from "./dto/save-zalo-oa-secret.request"
import type { ZaloAuthorizeRequest, ZaloAuthorizeResult } from "../../application/zalo-authorize.contracts"
import type { ZaloAuthorizeResponse } from "./dto/zalo-authorize.response"
import type { CheckConnectionRequest, CheckConnectionResult } from "../../application/check-connection.contracts"
import type { CheckConnectionResponse } from "./dto/check-connection.response"

/** Maps the HTTP path and body to the ConnectTelegram request. */
export const toConnectTelegramRequest = (workspaceId: string, body: ConnectTelegramBody): ConnectTelegramRequest => ({
    workspaceId,
    name: body.name,
    token: body.token,
})

/** Maps the ConnectTelegram result to the HTTP response. */
export const toConnectTelegramResponse = (result: ConnectTelegramResult): ConnectTelegramResponse => ({
    connection: result.connection,
    webhookRegistered: result.webhookRegistered,
})

/** Maps the HTTP path and body to the StartMoney request. */
export const toStartMoneyRequest = (workspaceId: string, body: StartMoneyBody): StartMoneyRequest => ({
    workspaceId,
    provider: body.provider,
    environment: body.environment,
    name: body.name,
    bankCode: body.bankCode,
    accountNumber: body.accountNumber,
    holder: body.holder,
})

/** Maps the StartMoney result to the HTTP response. */
export const toStartMoneyResponse = (result: StartMoneyResult): StartMoneyResponse => ({
    id: result.id,
    provider: result.provider,
    name: result.name,
    environment: result.environment,
    status: result.status,
    webhookUrl: result.webhookUrl,
    apiKey: result.apiKey,
    bankCode: result.bankCode,
    account: result.account,
    holder: result.holder,
    credentialsSaved: result.credentialsSaved,
    firstEvent: result.firstEvent,
    agentIds: result.agentIds,
})

/** Maps the HTTP path and body to the UpdateMoney request. */
export const toUpdateMoneyRequest = (
    workspaceId: string,
    connectionId: string,
    body: UpdateMoneyBody,
): UpdateMoneyRequest => ({
    workspaceId,
    connectionId,
    environment: body.environment,
    name: body.name,
    bankCode: body.bankCode,
    accountNumber: body.accountNumber,
    holder: body.holder,
    apiKey: body.apiKey,
})

/** Maps the UpdateMoney result to the HTTP response. */
export const toUpdateMoneyResponse = (result: UpdateMoneyResult): UpdateMoneyResponse => ({
    id: result.id,
    provider: result.provider,
    name: result.name,
    environment: result.environment,
    status: result.status,
    webhookUrl: result.webhookUrl,
    apiKey: result.apiKey,
    bankCode: result.bankCode,
    account: result.account,
    holder: result.holder,
    credentialsSaved: result.credentialsSaved,
    firstEvent: result.firstEvent,
    agentIds: result.agentIds,
})

/** Maps the HTTP path and body to the ResumeConnection request. */
export const toResumeConnectionRequest = (workspaceId: string, connectionId: string): ResumeConnectionRequest => ({
    workspaceId,
    connectionId,
})

/** Maps the ResumeConnection result to the HTTP response. */
export const toResumeConnectionResponse = (result: ResumeConnectionResult): ResumeConnectionResponse => ({
    id: result.id,
    provider: result.provider,
    name: result.name,
    environment: result.environment,
    status: result.status,
    webhookUrl: result.webhookUrl,
    apiKey: result.apiKey,
    bankCode: result.bankCode,
    account: result.account,
    holder: result.holder,
    credentialsSaved: result.credentialsSaved,
    firstEvent: result.firstEvent,
    agentIds: result.agentIds,
})

/** Maps the HTTP path and body to the RevealSepayKey request. */
export const toRevealSepayKeyRequest = (workspaceId: string, connectionId: string): RevealSepayKeyRequest => ({
    workspaceId,
    connectionId,
})

/** Maps the RevealSepayKey result to the HTTP response. */
export const toRevealSepayKeyResponse = (result: RevealSepayKeyResult): RevealSepayKeyResponse => ({
    apiKey: result.apiKey,
    webhookUrl: result.webhookUrl,
})

/** Maps the HTTP path and body to the SaveProviderKeys request. */
export const toSaveProviderKeysRequest = (
    workspaceId: string,
    connectionId: string,
    body: SaveProviderKeysBody,
): SaveProviderKeysRequest => ({ workspaceId, connectionId, values: body.values })

/** Maps the SaveProviderKeys result to the HTTP response. */
export const toSaveProviderKeysResponse = (result: SaveProviderKeysResult): SaveProviderKeysResponse => ({
    confirmed: result.confirmed,
    localOnly: result.localOnly,
})

/** Maps the HTTP path and body to the StartZalo request. */
export const toStartZaloRequest = (workspaceId: string, body: StartZaloBody): StartZaloRequest => ({
    workspaceId,
    name: body.name,
    appId: body.appId,
    appSecret: body.appSecret,
})

/** Maps the StartZalo result to the HTTP response. */
export const toStartZaloResponse = (result: StartZaloResult): StartZaloResponse => ({
    id: result.id,
    name: result.name,
    status: result.status,
    webhookUrl: result.webhookUrl,
    callbackUrl: result.callbackUrl,
    authorized: result.authorized,
    oaSecretSaved: result.oaSecretSaved,
    oaId: result.oaId,
    firstEvent: result.firstEvent,
    agentIds: result.agentIds,
})

/** Maps the HTTP path and body to the ResumeZalo request. */
export const toResumeZaloRequest = (workspaceId: string, connectionId: string): ResumeZaloRequest => ({
    workspaceId,
    connectionId,
})

/** Maps the ResumeZalo result to the HTTP response. */
export const toResumeZaloResponse = (result: ResumeZaloResult): ResumeZaloResponse => ({
    id: result.id,
    name: result.name,
    status: result.status,
    webhookUrl: result.webhookUrl,
    callbackUrl: result.callbackUrl,
    authorized: result.authorized,
    oaSecretSaved: result.oaSecretSaved,
    oaId: result.oaId,
    firstEvent: result.firstEvent,
    agentIds: result.agentIds,
})

/** Maps the HTTP path and body to the SaveZaloOaSecret request. */
export const toSaveZaloOaSecretRequest = (
    workspaceId: string,
    connectionId: string,
    body: SaveZaloOaSecretBody,
): SaveZaloOaSecretRequest => ({ workspaceId, connectionId, oaSecret: body.oaSecret })

/** Maps the HTTP path and body to the ZaloAuthorize request. */
export const toZaloAuthorizeRequest = (workspaceId: string, connectionId: string): ZaloAuthorizeRequest => ({
    workspaceId,
    connectionId,
})

/** Maps the ZaloAuthorize result to the HTTP response. */
export const toZaloAuthorizeResponse = (result: ZaloAuthorizeResult): ZaloAuthorizeResponse => ({ url: result.url })

/** Maps the HTTP path and body to the CheckConnection request. */
export const toCheckConnectionRequest = (workspaceId: string, connectionId: string): CheckConnectionRequest => ({
    workspaceId,
    connectionId,
})

/** Maps the CheckConnection result to the HTTP response. */
export const toCheckConnectionResponse = (result: CheckConnectionResult): CheckConnectionResponse => ({
    provider: result.provider,
    webhookOk: result.webhookOk,
    localOnly: result.localOnly,
    pending: result.pending,
    lastError: result.lastError,
})
