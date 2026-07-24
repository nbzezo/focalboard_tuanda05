// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import {render, screen, waitFor} from '@testing-library/react'
import '@testing-library/jest-dom'
import {Provider as ReduxProvider} from 'react-redux'
import userEvent from '@testing-library/user-event'
import thunk from 'redux-thunk'

import {TestBlockFactory} from '../../test/testBlockFactory'
import {mockStateStore, wrapIntl} from '../../testUtils'
import {createAutomationRule} from '../../automation'
import octoClient from '../../octoClient'

import RuleEditor from './ruleEditor'

jest.mock('../../octoClient')
jest.mock('../../mutator')
const mockedOctoClient = jest.mocked(octoClient, {shallow: true})

describe('components/automation/ruleEditor', () => {
    const board = TestBlockFactory.createBoard()

    function buildStore() {
        return mockStateStore([thunk], {
            automationRules: {rulesByBoard: {}, loading: false},
        })
    }

    beforeEach(() => {
        jest.clearAllMocks()
    })

    test('save is disabled until a name and at least one action are set', async () => {
        const rule = {...createAutomationRule(), boardId: board.id}
        render(wrapIntl(
            <ReduxProvider store={buildStore()}>
                <RuleEditor
                    board={board}
                    rule={rule}
                    onClose={jest.fn()}
                />
            </ReduxProvider>,
        ))

        expect(screen.getByRole('button', {name: 'Save'})).toBeDisabled()

        await userEvent.type(screen.getByLabelText('Name'), 'My rule')
        expect(screen.getByRole('button', {name: 'Save'})).toBeDisabled()

        await userEvent.click(screen.getByText('+ Add action'))
        expect(screen.getByRole('button', {name: 'Save'})).toBeEnabled()
    })

    test('saving a new rule calls createAutomationRule and closes', async () => {
        mockedOctoClient.createAutomationRule.mockResolvedValue({
            ...createAutomationRule(),
            id: 'rule1',
            boardId: board.id,
            name: 'My rule',
        })
        const onClose = jest.fn()
        const rule = {...createAutomationRule(), boardId: board.id}

        render(wrapIntl(
            <ReduxProvider store={buildStore()}>
                <RuleEditor
                    board={board}
                    rule={rule}
                    onClose={onClose}
                />
            </ReduxProvider>,
        ))

        await userEvent.type(screen.getByLabelText('Name'), 'My rule')
        await userEvent.click(screen.getByText('+ Add action'))
        await userEvent.click(screen.getByRole('button', {name: 'Save'}))

        await waitFor(() => {
            expect(onClose).toHaveBeenCalled()
        })
        expect(mockedOctoClient.createAutomationRule).toHaveBeenCalledWith(
            board.id,
            expect.objectContaining({name: 'My rule'}),
        )
    })

    test('shows the property picker only for triggers that need it', async () => {
        const rule = {...createAutomationRule(), boardId: board.id}
        render(wrapIntl(
            <ReduxProvider store={buildStore()}>
                <RuleEditor
                    board={board}
                    rule={rule}
                    onClose={jest.fn()}
                />
            </ReduxProvider>,
        ))

        expect(screen.queryByText('Property')).not.toBeInTheDocument()

        await userEvent.selectOptions(screen.getByLabelText('When'), 'property-changed')
        expect(screen.getByText('Property')).toBeInTheDocument()
    })
})
