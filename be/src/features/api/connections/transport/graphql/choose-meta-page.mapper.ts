import type { ChooseMetaPageRequest } from "../../application/choose-meta-page.contracts"
import type { MetaWizardConnection } from "@modules/domain/meta-connections"
import type { ChooseMetaPageInput } from "./dto/choose-meta-page.input"
import type { MetaWizardConnectionType } from "./dto/meta-wizard-connection.type"

/** Maps the GraphQL arguments of chooseMetaPage to the request. */
export const toChooseMetaPageRequest = (workspaceId: string, input: ChooseMetaPageInput): ChooseMetaPageRequest => ({
    workspaceId,
    connectionId: input.connectionId,
    pageId: input.pageId,
})

/** Maps the answer of chooseMetaPage to the GraphQL type. */
export const toChooseMetaPageType = (result: MetaWizardConnection): MetaWizardConnectionType => result
