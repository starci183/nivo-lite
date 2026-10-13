import { Injectable } from "@nestjs/common"
import { ConnectionsError, ConnectionsErrorCode, ConnectionsService, randomSecret } from "@modules/domain/connections"
import type { ConnectionActor, ConnectionRecord } from "@modules/domain/connections"
import { INSTAGRAM_FIELDS, InjectMetaClient, MetaError, MetaErrorCode, PAGE_FIELDS } from "@modules/integrations/meta"
import type { MetaClient, MetaFailure } from "@modules/integrations/meta"
import { MetaConnectionsError, MetaConnectionsErrorCode } from "./errors/meta-connections.error"
import type {
    MetaAuthorization,
    MetaCallbackInput,
    MetaCallbackResult,
    MetaCheck,
    MetaSecret,
    MetaWizardConnection,
} from "./meta-connections.contracts"
import { connectionIdOfReturn, parseMetaSecret } from "./meta-secret.policy"

const OWNER = ["owner"] as const
const MANAGER = ["owner", "manager"] as const
const DEFAULT_NAME = "Facebook & Instagram"

const FAILURE_CODES: Partial<Record<MetaFailure, MetaConnectionsErrorCode>> = {
    token: MetaConnectionsErrorCode.TokenRefused,
    permission: MetaConnectionsErrorCode.PermissionRefused,
    rate_limited: MetaConnectionsErrorCode.RateLimited,
}

@Injectable()
/**
 * The Meta (Facebook Pages + Instagram) connection wizard: the login, the Pages the person manages, the chosen Page subscribed to the
 * app webhook, and the check of what Meta really has. The Page token is kept sealed and never returned.
 */
export class MetaConnectionsService {
    constructor(
        private readonly connections: ConnectionsService,
        @InjectMetaClient() private readonly meta: MetaClient,
    ) {}

    /**
     * Wizard step 1: (re)starts the Meta login. A PENDING connection is created on first use (so the choice and the agents have a
     * place to live) and the signed state (workspace, person, connection, 10 minutes) goes to Meta.
     */
    async authorize(actor: ConnectionActor, connectionId: string | undefined): Promise<MetaAuthorization> {
        await this.connections.authorize(actor, OWNER)
        if (!this.meta.isConfigured()) {
            throw new MetaConnectionsError({ code: MetaConnectionsErrorCode.NotConfigured })
        }
        const id =
            connectionId === undefined
                ? await this.connections.create({
                      workspaceId: actor.workspaceId,
                      createdBy: actor.principalId,
                      provider: "meta",
                      name: DEFAULT_NAME,
                      status: "pending",
                      environment: "live",
                      meta: {},
                      secret: { plain: "{}", webhookSecret: randomSecret() },
                  })
                : (await this.ownMeta(actor, connectionId)).id
        const state = this.meta.sign({
            workspaceId: actor.workspaceId,
            userId: actor.principalId,
            returnTo: `/connections?connect=meta&id=${id}`,
        })
        const url = this.meta.authUrl(state)
        if (url === null) throw new MetaConnectionsError({ code: MetaConnectionsErrorCode.NotConfigured })
        return { connectionId: id, url }
    }

    /** Continues an unfinished (or broken) connection: the Pages waiting for the choice, or the chosen one. Tokens are never returned. */
    async resume(actor: ConnectionActor, connectionId: string): Promise<MetaWizardConnection> {
        await this.connections.authorize(actor, OWNER)
        return this.view(await this.ownMeta(actor, connectionId))
    }

    /**
     * Wizard step 2: the owner picked a Page (and with it the Instagram account linked to it). The Page is subscribed to the app
     * webhook fields, the app-level webhook is pointed at NIVO when the site is public, only that Page token is kept, and the
     * connection shows the Page name and the Instagram handle. One Page or Instagram account belongs to one live connection.
     */
    async choosePage(actor: ConnectionActor, connectionId: string, pageId: string): Promise<MetaWizardConnection> {
        await this.connections.authorize(actor, OWNER)
        const connection = await this.ownMeta(actor, connectionId)
        const choice = (await this.secretOf(connection.id)).pages?.find((page) => page.id === pageId)
        if (choice === undefined) throw new MetaConnectionsError({ code: MetaConnectionsErrorCode.PageGone })
        if (
            (await this.takenElsewhere("page_id", choice.id, connection.id)) ||
            (choice.ig !== null && (await this.takenElsewhere("ig_id", choice.ig.id, connection.id)))
        ) {
            throw new MetaConnectionsError({ code: MetaConnectionsErrorCode.PageInUse })
        }
        await this.viaMeta(() => this.meta.subscribePage(choice.id, choice.token))
        await this.meta.ensureAppSubscriptions().catch(() => undefined)
        const sealed: MetaSecret = { pageId: choice.id, pageToken: choice.token }
        await this.connections.writeSecret(connection.id, JSON.stringify(sealed))
        await this.connections.patch(actor.workspaceId, connection.id, {
            name: choice.name.slice(0, 60),
            status: "connected",
            lastError: null,
            meta: {
                page_id: choice.id,
                page_name: choice.name,
                ...(choice.category ? { category: choice.category } : {}),
                ...(choice.ig ? { ig_id: choice.ig.id, ig_username: choice.ig.username ?? "" } : {}),
            },
        })
        return this.view(await this.connections.get(actor.workspaceId, connection.id))
    }

    /**
     * The test step: asks Meta what it has. The Page subscription (Page token) and the app webhook subscription (app token) are read
     * from Graph, so the owner sees what is subscribed or exactly what is missing. With `repair` the subscriptions are made again first.
     */
    async check(actor: ConnectionActor, connectionId: string, repair: boolean): Promise<MetaCheck> {
        await this.connections.authorize(actor, MANAGER)
        const connection = await this.ownMeta(actor, connectionId)
        if (connection.status === "disconnected") throw this.notFound(connection.id)
        const secret = await this.secretOf(connection.id)
        if (!secret.pageId || !secret.pageToken)
            throw new MetaConnectionsError({ code: MetaConnectionsErrorCode.NoPage })
        const page = { pageId: secret.pageId, pageToken: secret.pageToken }
        const igId = connection.meta.ig_id ?? ""
        const base = {
            pageId: page.pageId,
            pageName: connection.meta.page_name ?? "",
            igUsername: connection.meta.ig_username ?? "",
            wantPage: PAGE_FIELDS,
            wantInstagram: INSTAGRAM_FIELDS,
            webhookUrl: this.meta.webhookUrl() ?? "",
            redirectUri: this.meta.redirectUri() ?? "",
            localOnly: this.connections.publicOrigin() === null,
            verifyTokenSet: this.meta.hasVerifyToken(),
        }
        try {
            if (repair) {
                await this.meta.subscribePage(page.pageId, page.pageToken)
                await this.meta.ensureAppSubscriptions().catch(() => undefined)
            }
            const status = await this.meta.subscriptionStatus({ ...page })
            const igOk =
                igId === "" ||
                (status.app?.instagram != null &&
                    status.app.instagram.urlMatches &&
                    status.app.instagram.missing.length === 0)
            const appOk =
                status.app === null ||
                (status.app.page !== null && status.app.page.urlMatches && status.app.page.missing.length === 0 && igOk)
            if (connection.status === "error") {
                await this.connections.patch(actor.workspaceId, connection.id, { status: "connected", lastError: null })
            }
            return {
                ...base,
                ok: status.page.subscribed && status.page.missing.length === 0 && appOk,
                tokenOk: true,
                page: status.page,
                appPage: status.app?.page ?? null,
                appInstagram: status.app?.instagram ?? null,
                appKnown: status.app !== null,
                repaired: repair,
            }
        } catch (error) {
            // A refused token is the one failure the owner must act on: mark the connection so the list says "connect again".
            if (error instanceof MetaError && error.params.failure === "token") {
                await this.connections.patch(actor.workspaceId, connection.id, {
                    status: "error",
                    lastError: MetaConnectionsErrorCode.TokenRefused,
                })
                return {
                    ...base,
                    ok: false,
                    tokenOk: false,
                    page: { subscribed: false, fields: [], missing: PAGE_FIELDS },
                    appPage: null,
                    appInstagram: null,
                    appKnown: false,
                    repaired: repair,
                }
            }
            throw this.mapMeta(error)
        }
    }

    /**
     * Finishes the Meta login. The signed state binds the return to the workspace, the person and the connection the wizard started;
     * the person must still be an owner or manager of that workspace. Only the Page tokens are kept, until the owner picks one.
     */
    async complete(input: MetaCallbackInput): Promise<MetaCallbackResult> {
        const state = this.safeVerify(input.state)
        const connectionId = state === null ? null : connectionIdOfReturn(state.r)
        const back = (result: string, id?: string): MetaCallbackResult => ({
            location: `${this.connections.siteBase()}/connections?connect=meta&meta=${result}${id ? `&id=${id}` : ""}`,
        })
        if (state === null || connectionId === null) return back(state === null ? "expired" : "failed")
        if (!this.meta.isConfigured()) return back("unavailable", connectionId)
        const actor: ConnectionActor = { principalId: state.u, workspaceId: state.w }
        try {
            await this.connections.authorize(actor, MANAGER)
            const connection = await this.connections.find(state.w, connectionId)
            if (connection === null || connection.provider !== "meta" || connection.status === "disconnected") {
                return back("denied", connectionId)
            }
            if (input.error || !input.code) return back("denied", connectionId)
            const userToken = await this.meta.exchangeCode(input.code)
            const pages = await this.meta.listPages(userToken)
            if (pages.length === 0) return back("nopages", connectionId)
            const current = await this.secretOf(connectionId)
            await this.connections.writeSecret(connectionId, JSON.stringify({ ...current, pages }))
            return back("ok", connectionId)
        } catch (error) {
            if (error instanceof ConnectionsError && error.code === ConnectionsErrorCode.Forbidden) {
                return back("denied", connectionId)
            }
            return back("failed", connectionId)
        }
    }

    /** Answers the webhook verification request of Meta: the challenge when it carries our verify token, otherwise a forbidden error. */
    answerChallenge(query: {
        mode: string | undefined
        verifyToken: string | undefined
        challenge: string | undefined
    }): string {
        const answer = this.meta.challenge(query)
        if (answer === null) throw new ConnectionsError({ code: ConnectionsErrorCode.Forbidden })
        return answer
    }

    /** Stops a disconnecting Page from sending its events to the app (best effort: a dead token has nothing to cancel). */
    async release(connection: ConnectionRecord): Promise<void> {
        if (connection.provider !== "meta") return
        const secret = await this.secretOf(connection.id).catch(() => ({}) as MetaSecret)
        if (!secret.pageId || !secret.pageToken) return
        await this.meta.unsubscribePage(secret.pageId, secret.pageToken).catch(() => undefined)
    }

    private safeVerify(value: string | undefined) {
        try {
            return this.meta.verify(value)
        } catch {
            return null
        }
    }

    private async takenElsewhere(key: "page_id" | "ig_id", value: string, connectionId: string): Promise<boolean> {
        const owner = await this.connections.findLiveByMeta("meta", key, value)
        return owner !== null && owner.id !== connectionId
    }

    private notFound(id: string): ConnectionsError {
        return new ConnectionsError({ code: ConnectionsErrorCode.NotFound, params: { id } })
    }

    private async ownMeta(actor: ConnectionActor, id: string): Promise<ConnectionRecord> {
        const connection = await this.connections.get(actor.workspaceId, id)
        if (connection.provider !== "meta") throw this.notFound(id)
        return connection
    }

    private async secretOf(connectionId: string): Promise<MetaSecret> {
        const sealed = await this.connections.readSecret(connectionId)
        return sealed === null ? {} : parseMetaSecret(sealed.plain)
    }

    private async view(connection: ConnectionRecord): Promise<MetaWizardConnection> {
        const secret = await this.secretOf(connection.id)
        return {
            id: connection.id,
            name: connection.name,
            status: connection.status,
            configured: this.meta.isConfigured(),
            pages: (secret.pages ?? []).map((page) => ({
                id: page.id,
                name: page.name,
                category: page.category ?? "",
                igId: page.ig?.id ?? "",
                igUsername: page.ig?.username ?? "",
            })),
            pageId: connection.meta.page_id ?? "",
            pageName: connection.meta.page_name ?? "",
            igId: connection.meta.ig_id ?? "",
            igUsername: connection.meta.ig_username ?? "",
            firstEvent: connection.firstEvent,
            agentIds: await this.connections.agentIds(connection.workspaceId, connection.id),
        }
    }

    private async viaMeta<T>(call: () => Promise<T>): Promise<T> {
        try {
            return await call()
        } catch (error) {
            throw this.mapMeta(error)
        }
    }

    private mapMeta(error: unknown): unknown {
        if (!(error instanceof MetaError)) return error
        if (error.code === MetaErrorCode.NotConfigured) {
            return new MetaConnectionsError({ code: MetaConnectionsErrorCode.NotConfigured, cause: error })
        }
        if (error.code === MetaErrorCode.Unreachable) {
            return new MetaConnectionsError({ code: MetaConnectionsErrorCode.Network, cause: error })
        }
        const code = FAILURE_CODES[String(error.params.failure) as MetaFailure] ?? MetaConnectionsErrorCode.Failed
        return new MetaConnectionsError({ code, cause: error })
    }
}
