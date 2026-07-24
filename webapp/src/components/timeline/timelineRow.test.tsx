// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import {fireEvent, render, screen} from '@testing-library/react'
import '@testing-library/jest-dom'

import {TestBlockFactory} from '../../test/testBlockFactory'
import {wrapIntl} from '../../testUtils'

import TimelineRow from './timelineRow'
import {getPxPerDay} from './timelineUtils'

describe('components/timeline/timelineRow', () => {
    const board = TestBlockFactory.createBoard()
    const card = TestBlockFactory.createCard(board)
    card.title = 'Test card'

    const viewStart = Date.UTC(2024, 0, 1)
    const from = Date.UTC(2024, 0, 10)
    const to = Date.UTC(2024, 0, 12)
    const pxPerDay = getPxPerDay('day')

    test('renders the card title', () => {
        render(wrapIntl(
            <TimelineRow
                card={card}
                range={{from, to}}
                viewStart={viewStart}
                zoom='day'
                readonly={false}
                isBlocked={false}
                onShowCard={jest.fn()}
                onChange={jest.fn()}
            />,
        ))
        expect(screen.getByTitle('Test card')).toBeInTheDocument()
    })

    test('clicking the bar without dragging calls onShowCard', () => {
        const mockShowCard = jest.fn()
        render(wrapIntl(
            <TimelineRow
                card={card}
                range={{from, to}}
                viewStart={viewStart}
                zoom='day'
                readonly={false}
                isBlocked={false}
                onShowCard={mockShowCard}
                onChange={jest.fn()}
            />,
        ))

        fireEvent.click(screen.getByTitle('Test card'))
        expect(mockShowCard).toBeCalledTimes(1)
    })

    test('dragging the bar by N days calls onChange with both dates shifted by N days', () => {
        const mockOnChange = jest.fn()
        render(wrapIntl(
            <TimelineRow
                card={card}
                range={{from, to}}
                viewStart={viewStart}
                zoom='day'
                readonly={false}
                isBlocked={false}
                onShowCard={jest.fn()}
                onChange={mockOnChange}
            />,
        ))

        const bar = screen.getByTitle('Test card')
        fireEvent.mouseDown(bar, {clientX: 0})
        fireEvent.mouseMove(document, {clientX: 3 * pxPerDay})
        fireEvent.mouseUp(document)

        expect(mockOnChange).toBeCalledTimes(1)
        const [newFrom, newTo] = mockOnChange.mock.calls[0]
        expect(newFrom - from).toBe(3 * 24 * 60 * 60 * 1000)
        expect(newTo - to).toBe(3 * 24 * 60 * 60 * 1000)
    })

    test('a drag that nets zero days does not call onChange, and clicking after it still opens the card', () => {
        const mockOnChange = jest.fn()
        const mockShowCard = jest.fn()
        render(wrapIntl(
            <TimelineRow
                card={card}
                range={{from, to}}
                viewStart={viewStart}
                zoom='day'
                readonly={false}
                isBlocked={false}
                onShowCard={mockShowCard}
                onChange={mockOnChange}
            />,
        ))

        const bar = screen.getByTitle('Test card')
        fireEvent.mouseDown(bar, {clientX: 0})
        fireEvent.mouseMove(document, {clientX: 2})
        fireEvent.mouseUp(document)

        expect(mockOnChange).not.toBeCalled()
    })

    test('does not start a drag when readonly', () => {
        const mockOnChange = jest.fn()
        render(wrapIntl(
            <TimelineRow
                card={card}
                range={{from, to}}
                viewStart={viewStart}
                zoom='day'
                readonly={true}
                isBlocked={false}
                onShowCard={jest.fn()}
                onChange={mockOnChange}
            />,
        ))

        const bar = screen.getByTitle('Test card')
        fireEvent.mouseDown(bar, {clientX: 0})
        fireEvent.mouseMove(document, {clientX: 3 * pxPerDay})
        fireEvent.mouseUp(document)

        expect(mockOnChange).not.toBeCalled()
    })

    test('shows the blocked styling when isBlocked is true', () => {
        render(wrapIntl(
            <TimelineRow
                card={card}
                range={{from, to}}
                viewStart={viewStart}
                zoom='day'
                readonly={false}
                isBlocked={true}
                onShowCard={jest.fn()}
                onChange={jest.fn()}
            />,
        ))

        expect(screen.getByTitle('Test card')).toHaveClass('TimelineRow__bar--blocked')
    })
})
