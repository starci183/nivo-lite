import { loadPackagesHfs as loadBePackages, starciBePackagesConfig } from "@starci/eslint-canon-be"
import { loadPackagesHfs as loadFePackages, starciFePackagesConfig } from "@starci/eslint-canon-fe"
import { coreGrammarPackagesConfig } from "@starci/eslint-grammar-core"

const be = loadBePackages(import.meta.url)
const fe = loadFePackages(import.meta.url)

export default [
    ...(await starciBePackagesConfig({ hfs: be })),
    ...starciFePackagesConfig({ hfs: fe }),
    ...coreGrammarPackagesConfig({ hfs: fe }),
]
