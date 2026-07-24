// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import {Extension} from '@tiptap/core'
import {PluginKey} from '@tiptap/pm/state'
import createSuggestionPlugin from '@tiptap/suggestion'

import emojiMartData from '@emoji-mart/data'

import EmojiList, {EmojiSuggestionItem} from './emojiList'
import {createSuggestionRender} from './suggestionRender'

type EmojiMartEmoji = {
    id: string
    keywords?: string[]
    skins: Array<{native: string}>
}

type EmojiMartData = {
    emojis: Record<string, EmojiMartEmoji>
}

const emojis = Object.values((emojiMartData as EmojiMartData).emojis)

const MAX_EMOJI_RESULTS = 20

function searchEmoji(query: string): EmojiSuggestionItem[] {
    if (!query) {
        return []
    }
    const lowerQuery = query.toLowerCase()
    const matches = emojis.filter((emoji) => {
        if (emoji.id.includes(lowerQuery)) {
            return true
        }
        return emoji.keywords?.some((keyword) => keyword.toLowerCase().includes(lowerQuery)) ?? false
    })
    return matches.slice(0, MAX_EMOJI_RESULTS).map((emoji) => ({id: emoji.id, native: emoji.skins[0].native}))
}

// Mirrors the old @draft-js-plugins/emoji behaviour: typing `:shortcode` and
// selecting a match replaces the typed text with the literal Unicode emoji
// character. Because the result is plain text (not a custom node), it round
// trips through markdown storage with zero special handling.
const EmojiSuggestion = Extension.create({
    name: 'emojiSuggestion',

    addProseMirrorPlugins() {
        return [
            createSuggestionPlugin<EmojiSuggestionItem, EmojiSuggestionItem>({
                editor: this.editor,
                pluginKey: new PluginKey('emojiSuggestion'),
                char: ':',
                allowSpaces: false,
                items: ({query}) => searchEmoji(query),
                command: ({editor, range, props}) => {
                    editor.chain().focus().insertContentAt(range, props.native).run()
                },
                render: createSuggestionRender(EmojiList),
            }),
        ]
    },
})

export default EmojiSuggestion
