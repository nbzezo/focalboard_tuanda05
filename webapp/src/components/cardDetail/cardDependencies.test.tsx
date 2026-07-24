// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import {render, screen} from '@testing-library/react'
import '@testing-library/jest-dom'
import userEvent from '@testing-library/user-event'
import {mocked} from 'jest-mock'
import {Provider as ReduxProvider} from 'react-redux'

import {TestBlockFactory} from '../../test/testBlockFactory'
import {blocksById, mockStateStore, wrapIntl} from '../../testUtils'
import {RootState} from '../../store'
import mutator from '../../mutator'

import CardDependencies from './cardDependencies'

jest.mock('../../mutator')
const mockedMutator = mocked(mutator, {shallow: true})

describe('components/cardDetail/cardDependencies', () => {
    const board = TestBlockFactory.createBoard()
    const cardA = TestBlockFactory.createCard(board)
    cardA.title = 'Card A'
    const cardB = TestBlockFactory.createCard(board)
    cardB.title = 'Card B'
    const cardC = TestBlockFactory.createCard(board)
    cardC.title = 'Card C'

    beforeEach(() => {
        jest.clearAllMocks()
    })

    function buildStore(cards: Array<typeof cardA>) {
        const state: Partial<RootState> = {
            boards: {
                current: board.id,
                boards: {[board.id]: board},
                templates: {},
            } as any,
            cards: {
                current: '',
                limitTimestamp: 0,
                cards: blocksById(cards),
                templates: {},
                cardHiddenWarning: false,
            },
        }
        return mockStateStore([], state)
    }

    test('shows the resolved title of each card in blockedBy', () => {
        cardA.fields.blockedBy = [cardB.id]
        const store = buildStore([cardA, cardB, cardC])

        render(wrapIntl(
            <ReduxProvider store={store}>
                <CardDependencies
                    card={cardA}
                    board={board}
                    readonly={false}
                />
            </ReduxProvider>,
        ))

        expect(screen.getByText('Card B')).toBeInTheDocument()
    })

    test('filters out blockedBy IDs that no longer resolve to a real card', () => {
        cardA.fields.blockedBy = ['deleted-card-id']
        const store = buildStore([cardA, cardB, cardC])

        render(wrapIntl(
            <ReduxProvider store={store}>
                <CardDependencies
                    card={cardA}
                    board={board}
                    readonly={false}
                />
            </ReduxProvider>,
        ))

        expect(screen.queryByText('deleted-card-id')).not.toBeInTheDocument()
    })

    test('shows cards that this card blocks (derived, read-only)', () => {
        cardA.fields.blockedBy = []
        cardB.fields.blockedBy = [cardA.id]
        const store = buildStore([cardA, cardB, cardC])

        render(wrapIntl(
            <ReduxProvider store={store}>
                <CardDependencies
                    card={cardA}
                    board={board}
                    readonly={false}
                />
            </ReduxProvider>,
        ))

        expect(screen.getByText('Blocks')).toBeInTheDocument()
        expect(screen.getByText('Card B')).toBeInTheDocument()
    })

    test('clicking remove calls mutator.removeCardDependency', () => {
        cardA.fields.blockedBy = [cardB.id]
        cardB.fields.blockedBy = []
        const store = buildStore([cardA, cardB, cardC])

        render(wrapIntl(
            <ReduxProvider store={store}>
                <CardDependencies
                    card={cardA}
                    board={board}
                    readonly={false}
                />
            </ReduxProvider>,
        ))

        const removeButton = screen.getByTitle('Remove')
        userEvent.click(removeButton)

        expect(mockedMutator.removeCardDependency).toBeCalledWith(board.id, cardA, cardB.id)
    })

    test('does not render remove buttons or the picker when readonly', () => {
        cardA.fields.blockedBy = [cardB.id]
        const store = buildStore([cardA, cardB, cardC])

        render(wrapIntl(
            <ReduxProvider store={store}>
                <CardDependencies
                    card={cardA}
                    board={board}
                    readonly={true}
                />
            </ReduxProvider>,
        ))

        expect(screen.queryByTitle('Remove')).not.toBeInTheDocument()
    })
})
