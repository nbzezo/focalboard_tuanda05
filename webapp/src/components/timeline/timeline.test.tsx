// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import {render, screen} from '@testing-library/react'
import '@testing-library/jest-dom'
import {Provider as ReduxProvider} from 'react-redux'

import {TestBlockFactory} from '../../test/testBlockFactory'
import {blocksById, mockStateStore, wrapIntl} from '../../testUtils'
import {IPropertyTemplate} from '../../blocks/board'

import TimelineView from './timeline'

jest.mock('../../mutator')

describe('components/timeline/timeline', () => {
    const dateProperty: IPropertyTemplate = {
        id: 'due-date',
        name: 'Due date',
        type: 'date',
        options: [],
    }
    const board = TestBlockFactory.createBoard()
    const view = TestBlockFactory.createBoardView(board)
    view.fields.viewType = 'timeline'

    const scheduledCard = TestBlockFactory.createCard(board)
    scheduledCard.title = 'Scheduled card'
    scheduledCard.fields.properties[dateProperty.id] = JSON.stringify({from: Date.UTC(2024, 5, 10, 12)})

    const unscheduledCard = TestBlockFactory.createCard(board)
    unscheduledCard.title = 'Unscheduled card'

    function buildStore() {
        return mockStateStore([], {
            cards: {
                current: '',
                limitTimestamp: 0,
                cards: blocksById([scheduledCard, unscheduledCard]),
                templates: {},
                cardHiddenWarning: false,
            },
        })
    }

    test('shows a prompt when no date property is configured', () => {
        render(wrapIntl(
            <ReduxProvider store={buildStore()}>
                <TimelineView
                    board={board}
                    activeView={view}
                    cards={[scheduledCard, unscheduledCard]}
                    dateDisplayProperty={undefined}
                    readonly={false}
                    showCard={jest.fn()}
                />
            </ReduxProvider>,
        ))

        expect(screen.getByText(/Add a date property/)).toBeInTheDocument()
    })

    test('splits cards into scheduled bars and an unscheduled tray', () => {
        render(wrapIntl(
            <ReduxProvider store={buildStore()}>
                <TimelineView
                    board={board}
                    activeView={view}
                    cards={[scheduledCard, unscheduledCard]}
                    dateDisplayProperty={dateProperty}
                    readonly={false}
                    showCard={jest.fn()}
                />
            </ReduxProvider>,
        ))

        expect(screen.getByTitle('Scheduled card')).toBeInTheDocument()
        expect(screen.getByText('Unscheduled')).toBeInTheDocument()
        expect(screen.getByText('Unscheduled card')).toBeInTheDocument()
    })

    test('clicking a scheduled bar calls showCard', () => {
        const mockShowCard = jest.fn()
        render(wrapIntl(
            <ReduxProvider store={buildStore()}>
                <TimelineView
                    board={board}
                    activeView={view}
                    cards={[scheduledCard]}
                    dateDisplayProperty={dateProperty}
                    readonly={false}
                    showCard={mockShowCard}
                />
            </ReduxProvider>,
        ))

        screen.getByTitle('Scheduled card').click()
        expect(mockShowCard).toBeCalledWith(scheduledCard.id)
    })

    test('clicking an unscheduled card calls showCard', () => {
        const mockShowCard = jest.fn()
        render(wrapIntl(
            <ReduxProvider store={buildStore()}>
                <TimelineView
                    board={board}
                    activeView={view}
                    cards={[unscheduledCard]}
                    dateDisplayProperty={dateProperty}
                    readonly={false}
                    showCard={mockShowCard}
                />
            </ReduxProvider>,
        ))

        screen.getByText('Unscheduled card').click()
        expect(mockShowCard).toBeCalledWith(unscheduledCard.id)
    })
})
