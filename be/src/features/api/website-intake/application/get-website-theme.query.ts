import { Query } from "@nestjs/cqrs"
import type { WorkspaceTheme } from "@modules/domain/workspace-settings"
import type { PublicExecuteParams } from "@modules/platform/cqrs"
import type { GetWebsiteThemeRequest } from "./get-website-theme.contracts"

/** Reads the theme parameters of the workspace behind a site key, for an anonymous visitor of its hosted page. */
export class GetWebsiteThemeQuery extends Query<WorkspaceTheme | null> {
    constructor(readonly params: PublicExecuteParams<GetWebsiteThemeRequest>) {
        super()
    }
}
