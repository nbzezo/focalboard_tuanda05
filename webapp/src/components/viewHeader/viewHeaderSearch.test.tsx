// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import {render, screen} from '@testing-library/react'
import {Provider as ReduxProvider} from 'react-redux'

import '@testing-library/jest-dom'
import userEvent from '@testing-library/user-event'

import {mockStateStore, wrapIntl} from '../../testUtils'

import ViewHeaderSearch from './viewHeaderSearch'

jest.mock('../../routeCompat', () => {
    const actual = jest.requireActual('../../routeCompat')

    return {
        ...actual,
        useAppRouteMatch: jest.fn(() => {
            return {params: {}, path: '', url: '/board/view'}
        }),
    }
})

describe('components/viewHeader/ViewHeaderSearch', () => {
    const state = {
        users: {
            me: {
                id: 'user-id-1',
                username: 'username_1'},
        },
        searchText: {
        },
    }

    const store = mockStateStore([], state)
    beforeEach(() => {
        jest.clearAllMocks()
    })
    test('return search menu', () => {
        const {container} = render(
            wrapIntl(
                <ReduxProvider store={store}>
                    <ViewHeaderSearch/>
                </ReduxProvider>,
            ),
        )
        expect(container).toMatchSnapshot()
    })
    test('search text after input', () => {
        const {container} = render(
            wrapIntl(
                <ReduxProvider store={store}>
                    <ViewHeaderSearch/>
                </ReduxProvider>,
            ),
        )
        const elementSearchText = screen.getByPlaceholderText('Search cards')
        userEvent.type(elementSearchText, 'Hello')
        expect(container).toMatchSnapshot()
    })
})
