// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import {ComponentType} from 'react'

import {ReactRenderer} from '@tiptap/react'
import type {SuggestionKeyDownProps, SuggestionProps} from '@tiptap/suggestion'

export type SuggestionListProps<Item> = {
    items: Item[]
    command: (item: Item) => void
}

export type SuggestionListRef = {
    onKeyDown: (props: {event: KeyboardEvent}) => boolean
}

type SuggestionRenderFns<Item> = {
    onStart: (props: SuggestionProps<Item, Item>) => void
    onUpdate: (props: SuggestionProps<Item, Item>) => void
    onKeyDown: (props: SuggestionKeyDownProps) => boolean
    onExit: () => void
}

// Shared "render" factory for @tiptap/suggestion (used by both the mention
// and emoji triggers): mounts a React list component into a floating popup
// anchored to the cursor (via the plugin's managed `mount` positioning), and
// forwards keyboard navigation to it. This mirrors the standard Tiptap
// suggestion-popup pattern.
export function createSuggestionRender<Item>(ListComponent: ComponentType<SuggestionListProps<Item>>): () => SuggestionRenderFns<Item> {
    return (): SuggestionRenderFns<Item> => {
        let component: ReactRenderer<SuggestionListRef, SuggestionListProps<Item>>
        let unmount: (() => void) | undefined

        return {
            onStart: (props: SuggestionProps<Item, Item>) => {
                component = new ReactRenderer(ListComponent, {
                    props: {items: props.items, command: props.command},
                    editor: props.editor,
                })
                if (!props.clientRect) {
                    return
                }
                unmount = props.mount(component.element)
            },
            onUpdate: (props: SuggestionProps<Item, Item>) => {
                component.updateProps({items: props.items, command: props.command})
            },
            onKeyDown: (props: SuggestionKeyDownProps) => {
                if (props.event.key === 'Escape') {
                    unmount?.()
                    return true
                }
                return component.ref?.onKeyDown({event: props.event}) ?? false
            },
            onExit: () => {
                unmount?.()
                component.destroy()
            },
        }
    }
}
