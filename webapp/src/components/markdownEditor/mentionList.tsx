// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import {forwardRef, Ref, useEffect, useImperativeHandle, useState} from 'react'
import {FormattedMessage} from 'react-intl'

import {IUser} from '../../user'
import GuestBadge from '../../widgets/guestBadge'

import {SuggestionListProps, SuggestionListRef} from './suggestionRender'

import './suggestionList.scss'

const BotBadge = (window as any).Components?.BotBadge

export type MentionUser = {
    user: IUser
    username: string
    avatar: string
    is_bot: boolean
    is_guest: boolean
    displayName: string
    isBoardMember: boolean
}

const MentionListComponent = (props: SuggestionListProps<MentionUser>, ref: Ref<SuggestionListRef>) => {
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
        <div className='SuggestionList MentionList'>
            {props.items.map((item, index) => (
                <div
                    key={item.user.id}
                    role='option'
                    aria-selected={index === selectedIndex}
                    className={`SuggestionList__item ${index === selectedIndex ? 'is-selected' : ''}`}
                    onMouseEnter={() => setSelectedIndex(index)}
                    onClick={() => selectItem(index)}
                >
                    <div className='SuggestionList__item-left'>
                        <img
                            src={item.avatar}
                            role='presentation'
                        />
                        <div className='SuggestionList__item-text'>
                            {item.username}
                            {BotBadge && item.is_bot && <BotBadge/>}
                            <GuestBadge show={item.is_guest}/>
                        </div>
                        <div className='SuggestionList__item-text'>
                            {item.displayName}
                        </div>
                    </div>
                    {!item.isBoardMember &&
                        <div className='SuggestionList__item-hint'>
                            <FormattedMessage
                                id='MentionSuggestion.is-not-board-member'
                                defaultMessage='(not board member)'
                            />
                        </div>}
                </div>
            ))}
        </div>
    )
}

const MentionList = forwardRef(MentionListComponent)

export default MentionList
