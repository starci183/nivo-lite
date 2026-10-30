import { builder } from "@starci/jest-preset"
import { nivoKnowledgeEntities } from "@modules/domain/nivo-knowledge"

const [NivoKnowledgeItemEntity] = nivoKnowledgeEntities
type NivoKnowledgeItem = InstanceType<typeof NivoKnowledgeItemEntity>

/** A stored base-knowledge item, with the fields a spec rarely changes filled. */
export const knowledgeRow = builder<NivoKnowledgeItem>({
    id: "n1",
    module: "core",
    slug: "voice",
    title: "Voice",
    body: "Warm.",
    kind: "tone",
    version: 1,
    embedding: null,
    fts: null,
    createdAt: new Date("2026-04-01T00:00:00.000Z"),
    updatedAt: new Date("2026-04-01T00:00:00.000Z"),
    embeddingModel: null,
})

/** A stored item with the given text. */
export const knowledgeRowWithText = (title: string, body: string): NivoKnowledgeItem => knowledgeRow({ title, body })

/** A stored item that was edited on 2026-04-01 10:30 +07:00 and is on its second version. */
export const editedKnowledgeRow = (): NivoKnowledgeItem =>
    knowledgeRow({ updatedAt: new Date("2026-04-01T10:30:00+07:00"), version: 2 })

/** The chatbot care playbook, stored on 2026-04-02. */
export const careKnowledgeRow = (): NivoKnowledgeItem =>
    knowledgeRow({
        id: "n2",
        module: "chatbot",
        slug: "care",
        title: "Care",
        body: "Answer fast.",
        kind: "playbook",
        updatedAt: new Date("2026-04-02T01:02:03.456Z"),
    })

/** A stored item whose body is `chars` letters long. */
export const longKnowledgeRow = (chars: number): NivoKnowledgeItem =>
    knowledgeRow({ id: "n1", title: "T", body: "x".repeat(chars) })
