import { Command, CommandRunner, Option } from "nest-commander"
import { ChannelProvisioningService } from "@modules/domain/channel-provisioning"
import type { ProvisionFlags } from "@modules/domain/channel-provisioning"

@Command({
    name: "connect-channel",
    description:
        "Connect a channel to a workspace as its owner: connect-channel <telegram|sepay|zalo> --workspace <id> (secrets come from CHANNEL_BOT_TOKEN, ZALO_APP_ID, ZALO_APP_SECRET)",
    arguments: "<kind>",
})
/** `cli connect-channel <kind>`: connects a Telegram bot, a SePay feed or a Zalo OA through the same capability as the console. */
export class ConnectChannelCli extends CommandRunner {
    constructor(private readonly provisioning: ChannelProvisioningService) {
        super()
    }

    /** Hands the kind and the flags to the provisioning capability; a refusal fails the command. */
    async run(passedParams: Array<string>, options: ProvisionFlags = {}): Promise<void> {
        await this.provisioning.run(passedParams[0] ?? "", options)
    }

    /** The workspace id. */
    @Option({ flags: "--workspace <id>", description: "Workspace id (its owner connects the channel)" })
    parseWorkspace(value: string): string {
        return value
    }

    /** The connection name. */
    @Option({ flags: "--name <name>", description: "Name of the connection" })
    parseName(value: string): string {
        return value
    }

    /** Test or live. */
    @Option({ flags: "--environment <env>", description: "SePay: test or live (default test)" })
    parseEnvironment(value: string): string {
        return value
    }

    /** The bank code. */
    @Option({ flags: "--bank-code <code>", description: "SePay: bank code, for example VCB" })
    parseBankCode(value: string): string {
        return value
    }

    /** The account number. */
    @Option({ flags: "--account <number>", description: "SePay: account number" })
    parseAccount(value: string): string {
        return value
    }

    /** The account holder. */
    @Option({ flags: "--holder <name>", description: "SePay: account holder" })
    parseHolder(value: string): string {
        return value
    }

    /** Binds the agents. */
    @Option({ flags: "--bind", description: "Give the workspace agents that can use the channel access to it" })
    parseBind(): boolean {
        return true
    }
}
