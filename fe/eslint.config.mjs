import { loadHfs, starciFeConfig } from "@starci/eslint-canon-fe"
import { coreGrammarConfig } from "@starci/eslint-grammar-core"

const hfs = loadHfs(import.meta.url)

export default [...starciFeConfig({ hfs }), ...coreGrammarConfig({ hfs })]
