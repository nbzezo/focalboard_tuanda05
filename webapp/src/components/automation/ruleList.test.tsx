// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import {render, screen} from '@testing-library/react'
import '@testing-library/jest-dom'
import {Provider as ReduxProvider} from 'react-redux'
import userEvent from '@testing-library/user-event'
import thunk from 'redux-thunk'

import {TestBlockFactory} from '../../test/testBlockFactory'
import {mockStateStore, wrapIntl} from '../../testUtils'
import {AutomationRule} from '../../automation'
import octoClient from '../../octoClient'

import RuleList from './ruleList'

jest.mock('../../octoClient')
jest.mock('../../mutator')
const mockedOctoClient = jest.mocked(octoClient, {shallow: true})

describe('components/automation/ruleList', () => {
    const board = TestBlockFactory.createBoard()

    const rule: AutomationRule = {
        id: 'rule1',
        boardId: board.id,
        name: 'Mark done',
        enabled: true,
        triggerType: 'card-created',
        triggerConfig: {},
        actions: [{type: 'add-comment', config: {message: 'hi'}}],
        createdBy: 'user1',
        modifiedBy: 'user1',
        createAt: 1,
        updateAt: 1,
        deleteAt: 0,
    }

    beforeEach(() => {
        jest.clearAllMocks()
        mockedOctoClient.getAutomationRules.mockResolvedValue([])
    })

    function buildStore(rules: AutomationRule[]) {
        return mockStateStore([thunk], {
            automationRules: {
                rulesByBoard: {[board.id]: rules},
                loading: false,
            },
        })
    }

    test('shows an empty state when there are no rules', () => {
        render(wrapIntl(
            <ReduxProvider store={buildStore([])}>
                <RuleList
                    board={board}
                    onClose={jest.fn()}
                />
            </ReduxProvider>,
        ))

        expect(screen.getByText('No automation rules yet')).toBeInTheDocument()
    })

    test('renders one row per rule, showing a disabled badge when applicable', () => {
        const disabledRule = {...rule, id: 'rule2', name: 'Disabled rule', enabled: false}
        render(wrapIntl(
            <ReduxProvider store={buildStore([rule, disabledRule])}>
                <RuleList
                    board={board}
                    onClose={jest.fn()}
                />
            </ReduxProvider>,
        ))

        expect(screen.getByText('Mark done')).toBeInTheDocument()
        expect(screen.getByText('Disabled rule')).toBeInTheDocument()
        expect(screen.getByText('Disabled')).toBeInTheDocument()
    })

    test('clicking + New rule opens the rule editor', async () => {
        render(wrapIntl(
            <ReduxProvider store={buildStore([])}>
                <RuleList
                    board={board}
                    onClose={jest.fn()}
                />
            </ReduxProvider>,
        ))

        await userEvent.click(screen.getByText('+ New rule'))
        expect(screen.getByText('Automation rule')).toBeInTheDocument()
    })
})
