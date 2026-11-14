import { Command, CommandRunner } from "nest-commander"
import { NamesOpenApiCli } from "./subs/names.cli"
import { PinViewOpenApiCli } from "./subs/pin-view.cli"
import { PinOpenApiCli } from "./subs/pin.cli"

@Command({
    name: "openapi",
    description:
        "Operate the OpenAPI document an API account of a workspace is pinned to (the account serves the tools the installed plugins declare only while its document stays the pinned one), and generate the names file of a source from its document",
    subCommands: [PinOpenApiCli, PinViewOpenApiCli, NamesOpenApiCli],
})
/** `cli openapi`: the group; its commands are the sub-commands (`pin`, `pin-view`, `names`). */
export class OpenApiCli extends CommandRunner {
    /** Without a sub-command the group shows its help. */
    run(): Promise<void> {
        return this.command.help()
    }
}
