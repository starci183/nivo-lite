import type { MetaAuthorizeRequest, MetaAuthorizeResult } from "../../application/meta-authorize.contracts"
import type { MetaAuthorizeBody } from "./dto/meta-authorize.request"
import type { MetaAuthorizeResponse } from "./dto/meta-authorize.response"
import type { ResumeMetaRequest, ResumeMetaResult } from "../../application/resume-meta.contracts"
import type { ResumeMetaResponse } from "./dto/resume-meta.response"
import type { ChooseMetaPageRequest, ChooseMetaPageResult } from "../../application/choose-meta-page.contracts"
import type { ChooseMetaPageBody } from "./dto/choose-meta-page.request"
import type { ChooseMetaPageResponse } from "./dto/choose-meta-page.response"
import type { CheckMetaRequest, CheckMetaResult } from "../../application/check-meta.contracts"
import type { CheckMetaBody } from "./dto/check-meta.request"
import type { CheckMetaResponse } from "./dto/check-meta.response"

/** Maps the HTTP path and body to the MetaAuthorize request. */
export const toMetaAuthorizeRequest = (workspaceId: string, body: MetaAuthorizeBody): MetaAuthorizeRequest => ({
    workspaceId,
    connectionId: body.connectionId,
})

/** Maps the MetaAuthorize result to the HTTP response. */
export const toMetaAuthorizeResponse = (result: MetaAuthorizeResult): MetaAuthorizeResponse => ({
    connectionId: result.connectionId,
    url: result.url,
})

/** Maps the HTTP path and body to the ResumeMeta request. */
export const toResumeMetaRequest = (workspaceId: string, connectionId: string): ResumeMetaRequest => ({
    workspaceId,
    connectionId,
})

/** Maps the ResumeMeta result to the HTTP response. */
export const toResumeMetaResponse = (result: ResumeMetaResult): ResumeMetaResponse => ({
    id: result.id,
    name: result.name,
    status: result.status,
    configured: result.configured,
    pages: result.pages.map((page) => ({ ...page })),
    pageId: result.pageId,
    pageName: result.pageName,
    igId: result.igId,
    igUsername: result.igUsername,
    firstEvent: result.firstEvent,
    agentIds: result.agentIds,
})

/** Maps the HTTP path and body to the ChooseMetaPage request. */
export const toChooseMetaPageRequest = (
    workspaceId: string,
    connectionId: string,
    body: ChooseMetaPageBody,
): ChooseMetaPageRequest => ({ workspaceId, connectionId, pageId: body.pageId })

/** Maps the ChooseMetaPage result to the HTTP response. */
export const toChooseMetaPageResponse = (result: ChooseMetaPageResult): ChooseMetaPageResponse => ({
    id: result.id,
    name: result.name,
    status: result.status,
    configured: result.configured,
    pages: result.pages.map((page) => ({ ...page })),
    pageId: result.pageId,
    pageName: result.pageName,
    igId: result.igId,
    igUsername: result.igUsername,
    firstEvent: result.firstEvent,
    agentIds: result.agentIds,
})

/** Maps the HTTP path and body to the CheckMeta request. */
export const toCheckMetaRequest = (
    workspaceId: string,
    connectionId: string,
    body: CheckMetaBody,
): CheckMetaRequest => ({ workspaceId, connectionId, repair: body.repair })

/** Maps the CheckMeta result to the HTTP response. */
export const toCheckMetaResponse = (result: CheckMetaResult): CheckMetaResponse => ({
    ...result,
    page: { subscribed: result.page.subscribed, fields: [...result.page.fields], missing: [...result.page.missing] },
    appPage:
        result.appPage === null
            ? null
            : { ...result.appPage, fields: [...result.appPage.fields], missing: [...result.appPage.missing] },
    appInstagram:
        result.appInstagram === null
            ? null
            : {
                  ...result.appInstagram,
                  fields: [...result.appInstagram.fields],
                  missing: [...result.appInstagram.missing],
              },
    wantPage: [...result.wantPage],
    wantInstagram: [...result.wantInstagram],
})
