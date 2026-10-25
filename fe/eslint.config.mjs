import { loadHfs, starciFeConfig } from "@starci/eslint-canon-fe"
import { starciGrammarConfig } from "@starci/eslint-grammar-starci"

const hfs = loadHfs(import.meta.url)

export default [...starciFeConfig({ hfs }), ...starciGrammarConfig({ hfs })]
