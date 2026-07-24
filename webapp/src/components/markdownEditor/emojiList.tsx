// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import {forwardRef, Ref, useEffect, useImperativeHandle, useState} from 'react'

import {SuggestionListProps, SuggestionListRef} from './suggestionRender'

import './suggestionList.scss'

export type EmojiSuggestionItem = {
    id: string
    native: string
}

const EmojiListComponent = (props: SuggestionListProps<EmojiSuggestionItem>, ref: Ref<SuggestionListRef>) => {
    const [selectedIndex, setSelectedIndex] = useState(0)

    useEffect(() => setSelectedIndex(0), [props.items])

    const selectItem = (index: number) => {
        const item = props.items[index]
        if (item) {
            props.command(item)
        }
    }

    useImperativeHandle(ref, () => ({
        onKeyDown: ({event}) => {
            if (event.key === 'ArrowUp') {
                setSelectedIndex((selectedIndex + (props.items.length - 1)) % props.items.length)
                return true
            }
            if (event.key === 'ArrowDown') {
                setSelectedIndex((selectedIndex + 1) % props.items.length)
                return true
            }
            if (event.key === 'Enter' || event.key === 'Tab') {
                selectItem(selectedIndex)
                return true
            }
            return false
        },
    }), [selectedIndex, props.items])

    if (props.items.length === 0) {
        return null
    }

    return (
        <div className='SuggestionList EmojiList'>
            {props.items.map((item, index) => (
                <div
                    key={item.id}
                    role='option'
                    aria-selected={index === selectedIndex}
                    className={`SuggestionList__item ${index === selectedIndex ? 'is-selected' : ''}`}
                    onMouseEnter={() => setSelectedIndex(index)}
                    onClick={() => selectItem(index)}
                >
                    <span className='EmojiList__icon'>{item.native}</span>
                    <span className='SuggestionList__item-text'>{`:${item.id}:`}</span>
                </div>
            ))}
        </div>
    )
}

const EmojiList = forwardRef(EmojiListComponent)

export default EmojiList
