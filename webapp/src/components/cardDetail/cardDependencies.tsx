// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import React, {useMemo} from 'react'
import {useIntl} from 'react-intl'
import Select from 'react-select'

import {Board} from '../../blocks/board'
import {Card} from '../../blocks/card'
import {useAppSelector} from '../../store/hooks'
import {getCurrentBoardCards, getCardDependencyMap} from '../../store/cards'
import {wouldCreateCycle} from '../../cardDependencyUtils'
import mutator from '../../mutator'
import IconButton from '../../widgets/buttons/iconButton'
import CloseIcon from '../../widgets/icons/close'

import './cardDependencies.scss'

type Props = {
    card: Card
    board: Board
    readonly: boolean
}

type CardOption = {
    id: string
    label: string
}

const cardTitle = (card: Card): string => card.title || 'Untitled'

const CardDependencies = (props: Props): JSX.Element => {
    const intl = useIntl()
    const {card, board, readonly} = props

    const boardCards = useAppSelector(getCurrentBoardCards)
    const dependencyMap = useAppSelector(getCardDependencyMap)

    const cardsById = useMemo(() => {
        const map: Record<string, Card> = {}
        for (const c of boardCards) {
            map[c.id] = c
        }
        return map
    }, [boardCards])

    // Filter out any IDs that no longer resolve to a real card (deleted cards).
    const blockedByIds = (card.fields.blockedBy || []).filter((id) => cardsById[id])
    const blocksIds = (dependencyMap[card.id] || []).filter((id) => cardsById[id])

    const availableOptions: CardOption[] = useMemo(() => {
        return boardCards.
            filter((c) => c.id !== card.id).
            filter((c) => !blockedByIds.includes(c.id)).
            filter((c) => !wouldCreateCycle(cardsById, card.id, c.id)).
            map((c) => ({id: c.id, label: cardTitle(c)}))
    }, [boardCards, card.id, blockedByIds, cardsById])

    return (
        <div className='CardDependencies'>
            <div className='CardDependencies__section'>
                <div className='CardDependencies__label'>
                    {intl.formatMessage({id: 'CardDependencies.blocked-by', defaultMessage: 'Blocked by'})}
                </div>
                {blockedByIds.map((id) => (
                    <div
                        key={id}
                        className='CardDependencies__item'
                    >
                        <span>{cardTitle(cardsById[id])}</span>
                        {!readonly &&
                            <IconButton
                                icon={<CloseIcon/>}
                                title={intl.formatMessage({id: 'CardDependencies.remove', defaultMessage: 'Remove'})}
                                onClick={() => mutator.removeCardDependency(board.id, card, id)}
                            />}
                    </div>
                ))}
                {!readonly &&
                    <Select
                        className='CardDependencies__picker'
                        classNamePrefix='CardDependencies__picker'
                        placeholder={intl.formatMessage({id: 'CardDependencies.add-blocked-by', defaultMessage: '+ Add'})}
                        options={availableOptions}
                        value={null}
                        onChange={(option) => {
                            if (option) {
                                mutator.addCardDependency(board.id, card, option.id)
                            }
                        }}
                        getOptionLabel={(o: CardOption) => o.label}
                        getOptionValue={(o: CardOption) => o.id}
                    />}
            </div>
            {blocksIds.length > 0 &&
                <div className='CardDependencies__section'>
                    <div className='CardDependencies__label'>
                        {intl.formatMessage({id: 'CardDependencies.blocks', defaultMessage: 'Blocks'})}
                    </div>
                    {blocksIds.map((id) => (
                        <div
                            key={id}
                            className='CardDependencies__item CardDependencies__item--readonly'
                        >
                            {cardTitle(cardsById[id])}
                        </div>
                    ))}
                </div>}
        </div>
    )
}

export default React.memo(CardDependencies)
