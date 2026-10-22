import { Command, CommandRunner } from "nest-commander"
import { RunSeedWorkspaceCli } from "./subs/run.cli"
import { EnsureSeedWorkspaceCli } from "./subs/ensure.cli"
import { RoleSeedWorkspaceCli } from "./subs/role.cli"
import { VerifySeedWorkspaceCli } from "./subs/verify.cli"
import { ProfileSeedWorkspaceCli } from "./subs/profile.cli"
import { OfficeSeedWorkspaceCli } from "./subs/office.cli"

@Command({
    name: "seed-workspace",
    description: "Explicit workspace accounts and authenticated member roles",
    subCommands: [
        RunSeedWorkspaceCli,
        EnsureSeedWorkspaceCli,
        RoleSeedWorkspaceCli,
        VerifySeedWorkspaceCli,
        ProfileSeedWorkspaceCli,
        OfficeSeedWorkspaceCli,
    ],
})
/** Groups explicit workspace access operations; private credentials are supplied by the selected target runner. */
export class SeedWorkspaceCli extends CommandRunner {
    /** Without a sub-command the group shows its help. */
    run(): Promise<void> {
        return this.command.help()
    }
}
