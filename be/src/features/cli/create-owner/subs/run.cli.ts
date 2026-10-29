import { CommandRunner, Option, SubCommand } from "nest-commander"
import { OwnersService } from "@modules/domain/owners"

/** What the operator typed. */
export interface CreateOwnerRequest {
    /** The sign-in address. */
    readonly email: string
    /** The password, 8 to 72 characters. */
    readonly password: string
}

@SubCommand({
    name: "run",
    description:
        "Create a confirmed account with a password, or set the password of the account that already has the address.",
})
/** `cli create-owner run --email <address> --password <password>`: the first sign-in of a clean database. */
export class RunCreateOwnerCli extends CommandRunner {
    constructor(private readonly owners: OwnersService) {
        super()
    }

    /** Creates the account (both flags are required). */
    run(_passedParams: Array<string>, options: CreateOwnerRequest): Promise<void> {
        return this.owners.createOwner(options.email, options.password)
    }

    /** The sign-in address. */
    @Option({ flags: "--email <address>", description: "The sign-in address of the owner", required: true })
    takeEmail(value: string): string {
        return value
    }

    /** The password. */
    @Option({ flags: "--password <password>", description: "The password, 8 to 72 characters", required: true })
    takePassword(value: string): string {
        return value
    }
}
