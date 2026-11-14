// Nivo adds the tone `info` to the Grammar's built-in tones (owner ruling grammar-own-style). Its four tokens are in brand.css.
import "@starci/grammar/common"

declare module "@starci/grammar/common" {
    interface GrammarToneRegistry {
        info: true
    }
}
