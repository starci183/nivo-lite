import { AgentMark } from "../../leaves/AgentMark"

/** Glyph, words and size supplied by the connected agent avatar block. */
export interface AgentAvatarBaseProps {
    readonly props: {
        readonly glyph: string
        readonly label: string
        readonly module: string
        readonly size?: "xs" | "sm" | "md" | "lg"
        readonly online?: boolean
    }
}

/** Draws the agent mark without reading the module registry or the locale. */
export const AgentAvatarBase = (props: AgentAvatarBaseProps) => (
    <AgentMark
        glyph={props.props.glyph}
        label={props.props.label}
        module={props.props.module}
        size={props.props.size}
        online={props.props.online}
    />
)
