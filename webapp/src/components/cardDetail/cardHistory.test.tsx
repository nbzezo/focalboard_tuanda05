// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import {render, screen, waitFor} from '@testing-library/react'
import '@testing-library/jest-dom'

import {TestBlockFactory} from '../../test/testBlockFactory'
import {wrapIntl} from '../../testUtils'
import octoClient from '../../octoClient'
import {IPropertyTemplate} from '../../blocks/board'

import CardHistory, {diffHistoryEntries} from './cardHistory'

jest.mock('../../octoClient')
const mockedOctoClient = jest.mocked(octoClient, {shallow: true})

describe('components/cardDetail/cardHistory diffHistoryEntries', () => {
    const board = TestBlockFactory.createBoard()
    const statusProperty: IPropertyTemplate = board.cardProperties.find((p) => p.name === 'Status')!

    test('detects a title change', () => {
        const older = TestBlockFactory.createCard(board)
        older.title = 'old title'
        const newer = {...older, title: 'new title'}

        const diff = diffHistoryEntries(newer, older, board)
        expect(diff.title).toBe(true)
        expect(diff.propertyNames).toHaveLength(0)
        expect(diff.contentCountChange).toBeUndefined()
    })

    test('resolves a changed property to its template name', () => {
        const older = TestBlockFactory.createCard(board)
        older.fields.properties = {[statusProperty.id]: 'value-a'}
        const newer = {
            ...older,
            fields: {...older.fields, properties: {[statusProperty.id]: 'value-b'}},
        }

        const diff = diffHistoryEntries(newer, older, board)
        expect(diff.title).toBe(false)
        expect(diff.propertyNames).toEqual(['Status'])
    })

    test('detects a content block count change', () => {
        const older = TestBlockFactory.createCard(board)
        older.fields.contentOrder = ['block1']
        const newer = {
            ...older,
            fields: {...older.fields, contentOrder: ['block1', 'block2']},
        }

        const diff = diffHistoryEntries(newer, older, board)
        expect(diff.contentCountChange).toEqual({from: 1, to: 2})
    })

    test('reports no changes for identical entries', () => {
        const entry = TestBlockFactory.createCard(board)
        const diff = diffHistoryEntries(entry, {...entry}, board)
        expect(diff.title).toBe(false)
        expect(diff.propertyNames).toHaveLength(0)
        expect(diff.contentCountChange).toBeUndefined()
    })
})

describe('components/cardDetail/cardHistory component', () => {
    const board = TestBlockFactory.createBoard()
    const card = TestBlockFactory.createCard(board)

    beforeEach(() => {
        jest.clearAllMocks()
    })

    test('shows an empty state when there is no history', async () => {
        mockedOctoClient.getBlockHistory.mockResolvedValue([])

        render(wrapIntl(
            <CardHistory
                card={card}
                board={board}
                onClose={jest.fn()}
            />,
        ))

        await waitFor(() => {
            expect(screen.getByText('No history yet')).toBeInTheDocument()
        })
    })

    test('renders one entry per history row, most recent first', async () => {
        const older = {...card, title: 'first title', updateAt: 100}
        const newer = {...card, title: 'second title', updateAt: 200}
        mockedOctoClient.getBlockHistory.mockResolvedValue([newer, older])

        render(wrapIntl(
            <CardHistory
                card={card}
                board={board}
                onClose={jest.fn()}
            />,
        ))

        await waitFor(() => {
            expect(screen.getByText('Title changed')).toBeInTheDocument()
        })
        expect(screen.getByText('Card created')).toBeInTheDocument()
    })
})
