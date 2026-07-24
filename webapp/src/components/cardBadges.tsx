// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import React, {useMemo} from 'react'
import {useIntl} from 'react-intl'

import {Card} from '../blocks/card'
import {useAppSelector} from '../store/hooks'
import {getCardContents} from '../store/contents'
import {getCardComments} from '../store/comments'
import {ContentBlock} from '../blocks/contentBlock'
import {CommentBlock} from '../blocks/commentBlock'
import TextIcon from '../widgets/icons/text'
import MessageIcon from '../widgets/icons/message'
import CheckIcon from '../widgets/icons/check'
import {calculateChecklistProgress} from '../checklistUtils'

import './cardBadges.scss'

type Props = {
    card: Card
    className?: string
}

type Checkboxes = {
    total: number
    checked: number
}

type Badges = {
    description: boolean
    comments: number
    checkboxes: Checkboxes
}

const hasBadges = (badges: Badges): boolean => {
    return badges.description || badges.comments > 0 || badges.checkboxes.total > 0
}

type ContentsType = Array<ContentBlock | ContentBlock[]>

const hasTextContent = (contents: ContentsType): boolean => {
    return contents.some((content) => {
        const blocks = Array.isArray(content) ? content : [content]
        return blocks.some((block) => block.type === 'text')
    })
}

const calculateBadges = (contents: ContentsType, comments: CommentBlock[]): Badges => {
    const {total, checked} = calculateChecklistProgress(contents)
    return {
        description: hasTextContent(contents),
        comments: comments.length,
        checkboxes: {
            total,
            checked,
        },
    }
}

const CardBadges = (props: Props) => {
    const {card, className} = props

    // getCardContents returns a fresh createSelector instance per call, so it's
    // memoized here to keep that selector's own cache alive across re-renders
    // of this component instance (otherwise every render would recompute
    // contents from scratch even when this card's data hasn't changed).
    const contentsSelector = useMemo(() => getCardContents(card.id), [card.id])
    const contents = useAppSelector(contentsSelector)
    const comments = useAppSelector(getCardComments(card.id))
    const badges = useMemo(() => calculateBadges(contents, comments), [contents, comments])
    if (!hasBadges(badges)) {
        return null
    }
    const intl = useIntl()
    const {checkboxes} = badges
    return (
        <div className={`CardBadges ${className || ''}`}>
            {badges.description &&
                <span title={intl.formatMessage({id: 'CardBadges.title-description', defaultMessage: 'This card has a description'})}>
                    <TextIcon/>
                </span>}
            {badges.comments > 0 &&
                <span title={intl.formatMessage({id: 'CardBadges.title-comments', defaultMessage: 'Comments'})}>
                    <MessageIcon/>
                    {badges.comments}
                </span>}
            {checkboxes.total > 0 &&
                <span title={intl.formatMessage({id: 'CardBadges.title-checkboxes', defaultMessage: 'Checkboxes'})}>
                    <CheckIcon/>
                    {`${checkboxes.checked}/${checkboxes.total}`}
                </span>}
        </div>
    )
}

export default React.memo(CardBadges)
