import type { MetaWizardConnection } from "@modules/domain/meta-connections"

/** What the ChooseMetaPage operation takes. */
export interface ChooseMetaPageRequest {
    /** The workspace the request is made in. */
    readonly workspaceId: string
    /** The connectionId of the path. */
    readonly connectionId: string
    /** The pageId sent by the caller. */
    readonly pageId: string
}

/** What the ChooseMetaPage operation answers. */
export type ChooseMetaPageResult = MetaWizardConnection
