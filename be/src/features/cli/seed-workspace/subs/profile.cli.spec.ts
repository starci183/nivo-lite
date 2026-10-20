import { mock } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import { WorkspaceProfileService } from "@modules/domain/workspace-seed"
import { ProfileSeedWorkspaceCli } from "./profile.cli"

describe("ProfileSeedWorkspaceCli", () => {
    const build = async () => {
        const profiles = mock<WorkspaceProfileService>()
        const moduleRef = await Test.createTestingModule({
            providers: [ProfileSeedWorkspaceCli, { provide: WorkspaceProfileService, useValue: profiles }],
        }).compile()
        return { cli: moduleRef.get(ProfileSeedWorkspaceCli), profiles }
    }

    it("passes the profile, the owner and the execute flag", async () => {
        const { cli, profiles } = await build()

        await expect(
            cli.run([], { profile: "hakuen", owner: "hakuen.demo@gmail.com", execute: true }),
        ).resolves.toBeUndefined()

        expect(profiles.profileOperator).toHaveBeenCalledWith({
            profile: "hakuen",
            owner: "hakuen.demo@gmail.com",
            execute: true,
        })
    })

    it("is a dry run with empty selectors when no option is given", async () => {
        const { cli, profiles } = await build()

        await cli.run([], {})

        expect(profiles.profileOperator).toHaveBeenCalledWith({ profile: "", owner: "", execute: false })
    })

    it("parses its options", async () => {
        const { cli } = await build()

        expect(cli.parseProfile("hakuen")).toBe("hakuen")
        expect(cli.parseOwner("a@b.c")).toBe("a@b.c")
        expect(cli.parseExecute()).toBe(true)
    })
})
