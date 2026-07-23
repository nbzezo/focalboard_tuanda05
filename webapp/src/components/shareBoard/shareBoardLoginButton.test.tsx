// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import {render} from '@testing-library/react'

import {TestBlockFactory} from '../../test/testBlockFactory'
import {wrapDNDIntl} from '../../testUtils'

import ShareBoardLoginButton from './shareBoardLoginButton'
jest.useFakeTimers()

const boardId = '1'

const board = TestBlockFactory.createBoard()
board.id = boardId

jest.mock('../../routeCompat', () => {
    const actual = jest.requireActual('../../routeCompat')

    return {
        ...actual,
        useAppRouteMatch: jest.fn(() => {
            return {
                params: {
                    teamId: 'team1',
                    boardId: 'boardId1',
                    viewId: 'viewId1',
                    cardId: 'cardId1',
                },
                path: '/team/:teamId/:boardId?/:viewId?/:cardId?',
                url: '/team/team1/boardId1/viewId1/cardId1',
            }
        }),
        useAppNavigation: jest.fn(() => ({push: jest.fn(), replace: jest.fn(), goBack: jest.fn()})),
    }
})

describe('src/components/shareBoard/shareBoardLoginButton', () => {
    const savedLocation = window.location

    afterEach(() => {
        window.location = savedLocation
    })

    test('should match snapshot', async () => {
        // delete window.location
        window.location = Object.assign(new URL('https://example.org/mattermost'))
        const result = render(
            wrapDNDIntl(
                <ShareBoardLoginButton/>,
            ))
        const renderer = result.container

        expect(renderer).toMatchSnapshot()
    })
})
