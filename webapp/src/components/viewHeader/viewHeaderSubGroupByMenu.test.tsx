// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import {render, screen} from '@testing-library/react'
import '@testing-library/jest-dom'
import userEvent from '@testing-library/user-event'
import {mocked} from 'jest-mock'

import {TestBlockFactory} from '../../test/testBlockFactory'
import mutator from '../../mutator'
import {wrapIntl} from '../../testUtils'
import {IPropertyTemplate} from '../../blocks/board'

import ViewHeaderSubGroupByMenu from './viewHeaderSubGroupByMenu'

jest.mock('../../mutator')
const mockedMutator = mocked(mutator, {shallow: true})

const board = TestBlockFactory.createBoard()
const activeView = TestBlockFactory.createBoardView(board)
const statusProperty = board.cardProperties.find((p) => p.name === 'Status')!
const priorityProperty: IPropertyTemplate = {
    id: 'priority-id',
    name: 'Priority',
    type: 'select',
    options: [],
}
board.cardProperties = [statusProperty, priorityProperty]

describe('components/viewHeader/viewHeaderSubGroupByMenu', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        activeView.fields.swimlaneById = undefined
    })

    test('renders eligible select properties, excluding the main groupByProperty', () => {
        render(
            wrapIntl(
                <ViewHeaderSubGroupByMenu
                    activeView={activeView}
                    groupByProperty={statusProperty}
                    swimlaneByProperty={undefined}
                    properties={board.cardProperties}
                />,
            ),
        )
        const buttonElement = screen.getByRole('button', {name: /Sub-group by/})
        userEvent.click(buttonElement)

        expect(screen.getByRole('button', {name: 'Priority'})).toBeInTheDocument()
        expect(screen.queryByRole('button', {name: 'Status'})).not.toBeInTheDocument()
    })

    test('clicking a property calls changeViewSwimlaneById', () => {
        render(
            wrapIntl(
                <ViewHeaderSubGroupByMenu
                    activeView={activeView}
                    groupByProperty={statusProperty}
                    swimlaneByProperty={undefined}
                    properties={board.cardProperties}
                />,
            ),
        )
        const buttonElement = screen.getByRole('button', {name: /Sub-group by/})
        userEvent.click(buttonElement)

        const priorityButton = screen.getByRole('button', {name: 'Priority'})
        userEvent.click(priorityButton)

        expect(mockedMutator.changeViewSwimlaneById).toBeCalledWith(activeView.boardId, activeView.id, undefined, priorityProperty.id)
    })

    test('clicking None clears an existing swimlaneById', () => {
        activeView.fields.swimlaneById = priorityProperty.id
        render(
            wrapIntl(
                <ViewHeaderSubGroupByMenu
                    activeView={activeView}
                    groupByProperty={statusProperty}
                    swimlaneByProperty={priorityProperty}
                    properties={board.cardProperties}
                />,
            ),
        )
        const buttonElement = screen.getByRole('button', {name: /Sub-group by/})
        userEvent.click(buttonElement)

        const noneButton = screen.getByRole('button', {name: 'None'})
        userEvent.click(noneButton)

        expect(mockedMutator.changeViewSwimlaneById).toBeCalledWith(activeView.boardId, activeView.id, priorityProperty.id, '')
    })
})
