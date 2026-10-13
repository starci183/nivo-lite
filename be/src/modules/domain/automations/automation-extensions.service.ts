import { Injectable } from "@nestjs/common"
import type { PipelineConfig } from "@modules/domain/automation-pipelines"
import type { TemplateDefinition } from "@modules/domain/automation-templates"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { eachInOrder } from "@modules/platform/primitives"
import type {
    AutomationExtension,
    GoogleAccount,
    OptionalExecutor,
    ScanContext,
    ScanOutcome,
} from "./automation-ports.contracts"
import { AutomationsLogEvent } from "./automations.log-events"

@Injectable()
/** Where other capabilities plug their executors, scans, ticks and switch-on hooks into the automations engine. */
export class AutomationExtensionsService {
    private readonly extensions: Array<AutomationExtension> = []

    constructor(@InjectLogger() private readonly logger: Logger) {}

    /** Registers an extension; the capability that owns it calls this once at boot. */
    add(extension: AutomationExtension): void {
        this.extensions.push(extension)
    }

    /** The executor an extension registered for a template, if any. */
    executorOf(templateKey: string): OptionalExecutor {
        return this.extensions
            .map((extension) => extension.executors?.[templateKey])
            .find((executor) => executor !== undefined)
    }

    /** Lets the extensions scan one pipeline; the first that owns the template answers, none when no extension does. */
    async scan(context: ScanContext): Promise<ScanOutcome> {
        let answer: ScanOutcome = null
        await eachInOrder(this.extensions, async (extension) => {
            if (answer !== null || extension.scan === undefined) return
            answer = await extension.scan(context)
        })
        return answer
    }

    /** Runs the tick of every extension; a failing tick is logged and the others still run. */
    async tick(now: Date): Promise<number> {
        let work = 0
        await eachInOrder(this.extensions, async (extension) => {
            if (extension.tick === undefined) return
            try {
                work += await extension.tick(now)
            } catch (cause) {
                this.logger.error(AutomationsLogEvent.ExtensionTickFailed, cause)
            }
        })
        return work
    }

    /** Lets the extensions prepare the config of a template at its switch-on, one after the other. */
    async prepareEnable(
        workspaceId: string,
        userId: string,
        def: TemplateDefinition,
        config: PipelineConfig,
    ): Promise<PipelineConfig> {
        let prepared = config
        await eachInOrder(this.extensions, async (extension) => {
            if (extension.prepareEnable !== undefined) {
                prepared = await extension.prepareEnable(workspaceId, userId, def, prepared)
            }
        })
        return prepared
    }

    /** The Google accounts of a workspace, from the extension that knows them. */
    async googleAccounts(workspaceId: string): Promise<ReadonlyArray<GoogleAccount>> {
        const accounts: Array<GoogleAccount> = []
        await eachInOrder(this.extensions, async (extension) => {
            if (extension.googleAccounts !== undefined) accounts.push(...(await extension.googleAccounts(workspaceId)))
        })
        return accounts
    }
}
