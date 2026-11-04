import { NodeVocabulary } from "../../node/vocabulary"

/** A vocabulary with one extra provider and one extra kind of node registered, for a spec of anything that reads the registry. */
export const sampleVocabulary = (): NodeVocabulary => {
    const vocabulary = new NodeVocabulary()
    vocabulary.add({
        providers: ["fake-provider"],
        kinds: [{ kind: "fake", steps: ["fake_step"], facts: {}, checks: ["fake_check"] }],
    })
    return vocabulary
}
