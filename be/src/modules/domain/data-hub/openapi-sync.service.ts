import { Injectable } from "@nestjs/common"
import {
    DataSourcesError,
    InjectOpenApi,
    itemsOf,
    openApiFailure,
    parseJsonBody,
} from "@modules/integrations/data-sources"
import type {
    OpenApiAuth,
    OpenApiClient,
    OpenApiConfig,
    OpenApiOperation,
    OpenApiPull,
} from "@modules/integrations/data-sources"
import { eachInOrder } from "@modules/platform/primitives"
import type { DataConnector, DataRecordInput, DataSyncContext, DataSyncResult } from "./data-hub.contracts"
import { DataHubError, DataHubErrorCode } from "./errors/data-hub.error"
import { OPENAPI_WIZARD_TEXT } from "./messages/openapi.messages"
import { parseAuth, parseConfig } from "./openapi-config.policy"
import {
    PULL_MAX_PAGES,
    PULL_PAGE_SIZE,
    cursorKey,
    idOf,
    nextLinkOf,
    pageInput,
    pagingOf,
    parseCursor,
    toRecord,
} from "./openapi-pull.policy"
import type { PullPaging } from "./openapi-pull.policy"

/** The state of one operation being pulled, page after page. */
interface PullRun {
    /** The sync being served. */
    readonly context: DataSyncContext
    /** The connection config. */
    readonly config: OpenApiConfig
    /** The credential. */
    readonly auth: OpenApiAuth
    /** The operation pulled. */
    readonly op: OpenApiOperation
    /** How the operation is pulled. */
    readonly pull: OpenApiPull
    /** The paging parameters of the operation. */
    readonly paging: PullPaging
    /** The origin of the base URL: next links are followed only there. */
    readonly origin: string
    /** The page this run started from. */
    readonly startPage: number
    /** Rows written so far. */
    total: number
    /** The next link to follow, or null. */
    link: URL | null
    /** The id of the first item of the first page, to notice an API that ignores the page parameter. */
    firstId: string
}

/** What one pulled operation left behind. */
interface PullOutcome {
    /** Rows written. */
    readonly rows: number
    /** The cursor to resume from, or empty when the pull finished. */
    readonly cursor: string
}

const invalid = (detail: string): DataHubError =>
    new DataHubError({ code: DataHubErrorCode.Invalid, params: { detail } })

const sameOrigin = (raw: string, origin: string): URL | null => {
    if (!URL.canParse(raw)) return null
    const url = new URL(raw)
    return url.origin === origin ? url : null
}

const detailOf = (cause: DataHubError | DataSourcesError): string => {
    const detail = cause.params.detail
    return typeof detail === "string" ? detail : cause.code
}

@Injectable()
/** Pulls the owner APIs into the hub: every configured GET endpoint, page after page. */
export class OpenApiSyncService implements DataConnector {
    /** The provider this connector serves. */
    readonly provider = "openapi" as const

    constructor(@InjectOpenApi() private readonly client: OpenApiClient) {}

    /** Pulls every configured endpoint; a failing endpoint is reported in the note unless all of them fail. */
    async sync(context: DataSyncContext): Promise<DataSyncResult> {
        const config = parseConfig(context.connection.meta.config)
        if (config === null) throw invalid(OPENAPI_WIZARD_TEXT.syncNotConfigured)
        if (config.pulls.length === 0) throw invalid(OPENAPI_WIZARD_TEXT.syncNoPulls)
        const auth = parseAuth(context.credential)
        let rows = 0
        let finished = 0
        let firstFailure: DataHubError | DataSourcesError | undefined
        const errors: Array<string> = []
        const meta: Record<string, string> = {}
        await eachInOrder(config.pulls, async (pull) => {
            const op = config.ops.find((candidate) => candidate.id === pull.opId)
            if (context.isExpired() || !op) return
            try {
                const outcome = await this.pullOperation(context, config, auth, op, pull)
                rows += outcome.rows
                meta[cursorKey(op.id)] = outcome.cursor
                finished += 1
            } catch (cause) {
                if (!(cause instanceof DataHubError || cause instanceof DataSourcesError)) throw cause
                firstFailure ??= cause
                errors.push(`${op.method} ${op.path}: ${detailOf(cause)}`)
            }
        })
        if (errors.length >= config.pulls.length && firstFailure !== undefined) throw firstFailure
        const note = this.noteOf(errors, config.pulls.length - finished - errors.length)
        return { rows, meta, ...(note === undefined ? {} : { note }) }
    }

    private noteOf(errors: ReadonlyArray<string>, left: number): string | undefined {
        if (errors.length > 0) return errors.join(" | ").slice(0, 400)
        return left > 0 ? OPENAPI_WIZARD_TEXT.syncUnfinished : undefined
    }

    private pullOperation(
        context: DataSyncContext,
        config: OpenApiConfig,
        auth: OpenApiAuth,
        op: OpenApiOperation,
        pull: OpenApiPull,
    ): Promise<PullOutcome> {
        const origin = new URL(config.baseUrl).origin
        const resume = parseCursor(context.connection.meta[cursorKey(op.id)])
        const run: PullRun = {
            context,
            config,
            auth,
            op,
            pull,
            paging: pagingOf(op, pull),
            origin,
            startPage: resume?.page ?? 0,
            total: 0,
            link: resume?.link ? sameOrigin(resume.link, origin) : null,
            firstId: "",
        }
        return this.readPage(run, run.startPage)
    }

    /** Reads one page, writes its rows and goes on to the next page until the data ends, the pages run out or time does. */
    private async readPage(run: PullRun, page: number): Promise<PullOutcome> {
        if (page >= run.startPage + PULL_MAX_PAGES) return { rows: run.total, cursor: "" }
        if (run.context.isExpired()) {
            return { rows: run.total, cursor: JSON.stringify({ page, link: run.link?.toString() ?? "" }) }
        }
        const answer = await this.client.call({
            baseUrl: run.config.baseUrl,
            op: run.op,
            auth: run.auth,
            input: pageInput(run.paging, page),
            fixedQuery: run.pull.fixedQuery,
            ...(run.link ? { link: run.link.toString() } : {}),
        })
        if (answer.status < 200 || answer.status >= 300) throw invalid(openApiFailure(answer.status))
        const body = parseJsonBody(answer.text)
        const items = itemsOf(body, run.pull.itemsPath)
        const rows = new Map<string, DataRecordInput>()
        for (const item of items) {
            const record = toRecord(item, run.pull)
            rows.set(record.externalId, record)
        }
        const firstOfPage = items.length ? idOf(items[0], run.pull) : ""
        // The API ignores the page parameter: the same first item came back.
        if (page > run.startPage && firstOfPage && firstOfPage === run.firstId) return { rows: run.total, cursor: "" }
        if (page === run.startPage) run.firstId = firstOfPage
        if (rows.size) run.total += await run.context.upsert(run.pull.entity, [...rows.values()])
        if (!items.length) return { rows: run.total, cursor: "" }
        // A next link is followed only on the host of the base URL, so the credential never goes elsewhere.
        const next = nextLinkOf(body, answer.headers, run.link ?? new URL(run.config.baseUrl))
        if (next && next.origin === run.origin && next.toString() !== run.link?.toString()) {
            run.link = next
            return this.readPage(run, page + 1)
        }
        run.link = null
        if (this.lastPage(run.paging, items.length)) return { rows: run.total, cursor: "" }
        return this.readPage(run, page + 1)
    }

    private lastPage(paging: PullPaging, count: number): boolean {
        if (!paging.pageParam && !paging.offsetParam) return true
        return paging.limitParam ? count < PULL_PAGE_SIZE : count < 10
    }
}
