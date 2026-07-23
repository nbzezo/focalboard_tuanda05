// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// @emoji-mart v5 packages ship without TypeScript declarations.
declare module '@emoji-mart/data' {
    const data: Record<string, unknown>
    export default data
}

declare module '@emoji-mart/react' {
    import {ComponentType} from 'react'

    export type EmojiMartPickerProps = {
        data: Record<string, unknown>
        onEmojiSelect?: (emoji: {id: string, native: string, shortcodes: string}) => void
        theme?: 'auto' | 'light' | 'dark'
        [key: string]: unknown
    }

    const Picker: ComponentType<EmojiMartPickerProps>
    export default Picker
}
