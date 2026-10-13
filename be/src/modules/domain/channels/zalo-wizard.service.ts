import { Injectable } from "@nestjs/common"
import { ConnectionSecretsService } from "@modules/domain/connection-secrets"
import { ConnectionsService } from "@modules/domain/connections"
import type { WizardSettlement } from "@modules/domain/connections"
import { ZaloWizardDraftsService } from "@modules/domain/zalo-wizard-drafts"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { isZaloWizardPayload } from "@modules/queues/zalo-wizard"
import type { ZaloWizardPayload } from "@modules/queues/zalo-wizard"
import { ChannelsLogEvent } from "./channels.log-events"
import { ChannelsError, ChannelsErrorCode } from "./errors/channels.error"
import { ZaloCredentialsService } from "./zalo-credentials.service"

/** The zalo_oa provider key of the connections table. */
const PROVIDER = "zalo_oa"

const done = (command: string, extra: Partial<WizardSettlement> = {}): WizardSettlement => ({
    command,
    state: "done",
    url: "",
    code: "",
    oaSecretSaved: false,
    ...extra,
})

const failed = (command: string, code: ChannelsErrorCode): WizardSettlement => ({
    command,
    state: "failed",
    url: "",
    code,
    oaSecretSaved: false,
})

@Injectable()
/**
 * The three steps of the Zalo connection wizard that need the back end: sealing the app keys, sealing the OA Secret Key and building the Zalo
 * permission URL. The keys come from a draft the wizard's database function wrote (never from the queue payload) and the draft is removed once
 * sealed. The result is written on the connection row next to the ticket of the request, where the wizard reads it. A refusal the owner can
 * act on is a failed result; anything else is thrown and the queue tries again.
 */
export class ZaloWizardService {
    constructor(
        @InjectLogger() private readonly logger: Logger,
        private readonly secrets: ConnectionSecretsService,
        private readonly drafts: ZaloWizardDraftsService,
        private readonly connections: ConnectionsService,
        private readonly credentials: ZaloCredentialsService,
    ) {}

    /** Runs one wizard job; a payload that is not one is ignored. */
    async run(payload: unknown): Promise<void> {
        if (!isZaloWizardPayload(payload)) return
        const settlement = await this.perform(payload).catch((cause: unknown) => {
            if (!(cause instanceof ChannelsError)) throw cause
            this.logger.error(ChannelsLogEvent.ZaloWizardRefused, cause, {
                connectionId: payload.connectionId,
                command: payload.command,
            })
            return failed(payload.command, cause.code)
        })
        await this.connections.settleWizard(payload.connectionId, payload.ticket, settlement)
    }

    private perform(payload: ZaloWizardPayload): Promise<WizardSettlement> {
        if (payload.command === "begin") return this.begin(payload)
        return payload.command === "app" ? this.sealApp(payload) : this.sealOa(payload)
    }

    private async begin(payload: ZaloWizardPayload): Promise<WizardSettlement> {
        const authorization = await this.credentials.beginAuthorization(payload.workspaceId, payload.connectionId)
        return done(payload.command, { url: authorization.url })
    }

    private async sealApp(payload: ZaloWizardPayload): Promise<WizardSettlement> {
        await this.requireConnection(payload)
        const { present, appId, appSecret } = await this.drafts.draftOf(payload.connectionId)
        if (!present) return this.alreadySealed(payload)
        if (appId === "" || appSecret === "") return failed(payload.command, ChannelsErrorCode.SecretUnreadable)
        // The OA secret key is copied later, from the Webhook screen; until then every webhook is refused (a blank key never verifies).
        await this.secrets.save(
            payload.connectionId,
            this.secrets.seal(JSON.stringify({ appId, appSecret, oaSecret: "" })),
        )
        await this.drafts.dropDraft(payload.connectionId)
        return done(payload.command)
    }

    private async sealOa(payload: ZaloWizardPayload): Promise<WizardSettlement> {
        await this.requireConnection(payload)
        const { present, oaSecret } = await this.drafts.draftOf(payload.connectionId)
        if (!present || oaSecret === "") return this.alreadySealed(payload)
        const loaded = await this.credentials.load(payload.connectionId)
        if (loaded.kind !== "ok") return failed(payload.command, ChannelsErrorCode.SecretUnreadable)
        await this.secrets.save(
            payload.connectionId,
            this.secrets.seal(JSON.stringify({ ...loaded.value.secret, oaSecret })),
        )
        await this.drafts.dropDraft(payload.connectionId)
        return done(payload.command, { oaSecretSaved: true })
    }

    /** A redelivered job finds its draft gone: it is done when the credential is readable, failed when it never was written. */
    private async alreadySealed(payload: ZaloWizardPayload): Promise<WizardSettlement> {
        const loaded = await this.credentials.load(payload.connectionId)
        if (loaded.kind !== "ok") return failed(payload.command, ChannelsErrorCode.SecretUnreadable)
        return done(payload.command, { oaSecretSaved: payload.command === "oa" && loaded.value.secret.oaSecret !== "" })
    }

    /** The connection must be a Zalo connection of the workspace the owner proved. */
    private async requireConnection(payload: ZaloWizardPayload): Promise<void> {
        const intake = await this.connections.intakeOf(payload.connectionId, PROVIDER)
        if (intake.kind !== "ok" || intake.value.workspaceId !== payload.workspaceId) {
            throw new ChannelsError({ code: ChannelsErrorCode.ConnectionNotFound })
        }
    }
}
