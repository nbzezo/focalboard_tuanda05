// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {render, screen, waitFor} from '@testing-library/react'

import {MemoryRouter} from 'react-router-dom'

import {Provider as ReduxProvider} from 'react-redux'

import userEvent from '@testing-library/user-event'

import configureStore from 'redux-mock-store'

import {mocked} from 'jest-mock'

import thunk from 'redux-thunk'

import {wrapIntl} from '../../testUtils'

import mutator from '../../mutator'

import octoClient from '../../octoClient'

import {IUser} from '../../user'

import WelcomePage from './welcomePage'

const w = (window as any)
const oldBaseURL = w.baseURL

// Controllable navigation used in place of the v5 history object. The
// component calls history.replace(...) via useAppNavigation(); we assert on
// this spy. useAppRouteMatch stays real (requireActual).
const mockHistory = {
    push: jest.fn(),
    replace: jest.fn(),
    goBack: jest.fn(),
}
jest.mock('../../routeCompat', () => {
    const actual = jest.requireActual('../../routeCompat')
    return {
        ...actual,
        useAppNavigation: () => mockHistory,
    }
})

jest.mock('../../mutator')
const mockedMutator = mocked(mutator, {shallow: true})

jest.mock('../../octoClient')
const mockedOctoClient = mocked(octoClient, {shallow: true})

beforeEach(() => {
    jest.resetAllMocks()
    mockHistory.replace = jest.fn()
    mockHistory.push = jest.fn()
    mockedMutator.patchUserConfig.mockImplementation(() => Promise.resolve([
        {
            user_id: '',
            category: 'focalboard',
            name: 'welcomePageViewed',
            value: '1',
        },
    ]))
    mockedOctoClient.prepareOnboarding.mockResolvedValue({
        teamID: 'team_id_1',
        boardID: 'board_id_1',
    })
})

afterEach(() => {
    w.baseURL = oldBaseURL
})

describe('pages/welcome', () => {
    const mockStore = configureStore([thunk])
    const store = mockStore({
        teams: {
            current: {id: 'team_id_1'},
        },
        users: {
            me: {
                props: {},
            },
            myConfig: {
                onboardingTourStep: {value: '0'},
                tourCategory: {value: 'onboarding'},
            },
        },
    })

    test('Welcome Page shows Explore Page', () => {
        const component = (
            <ReduxProvider store={store}>
                {
                    wrapIntl(
                        <MemoryRouter>
                            <WelcomePage/>
                        </MemoryRouter>,
                    )
                }
            </ReduxProvider>
        )

        const {container} = render(component)
        expect(screen.getByText('Take a tour')).toBeDefined()
        expect(container).toMatchSnapshot()
    })

    test('Welcome Page shows Explore Page with subpath', () => {
        w.baseURL = '/subpath'
        const component = (
            <ReduxProvider store={store}>
                {
                    wrapIntl(
                        <MemoryRouter>
                            <WelcomePage/>
                        </MemoryRouter>,
                    )
                }
            </ReduxProvider>
        )

        const {container} = render(component)
        expect(screen.getByText('Take a tour')).toBeDefined()
        expect(container).toMatchSnapshot()
    })

    test('Welcome Page shows Explore Page And Then Proceeds after Clicking Explore', async () => {
        const component = (
            <ReduxProvider store={store}>
                {
                    wrapIntl(
                        <MemoryRouter>
                            <WelcomePage/>
                        </MemoryRouter>,
                    )
                }
            </ReduxProvider>
        )

        render(component)
        const exploreButton = screen.getByText('No thanks, I\'ll figure it out myself')
        expect(exploreButton).toBeDefined()
        userEvent.click(exploreButton)
        await waitFor(() => {
            expect(mockHistory.replace).toBeCalledWith('/team/team_id_1')
            expect(mockedMutator.patchUserConfig).toBeCalledTimes(1)
        })
    })

    test('Welcome Page does not render explore page the second time we visit it', async () => {
        const customStore = mockStore({
            teams: {
                current: {id: 'team_id_1'},
            },
            users: {
                me: {},
                myConfig: {
                    welcomePageViewed: {value: '1'},
                },
            },
        })

        const component = (
            <ReduxProvider store={customStore}>
                {
                    wrapIntl(
                        <MemoryRouter>
                            <WelcomePage/>
                        </MemoryRouter>,
                    )
                }
            </ReduxProvider>
        )

        render(component)
        await waitFor(() => {
            expect(mockHistory.replace).toBeCalledWith('/team/team_id_1')
        })
    })

    test('Welcome Page redirects us when we have a r query parameter with welcomePageViewed set to true', async () => {
        const customStore = mockStore({
            teams: {
                current: {id: 'team_id_1'},
            },
            users: {
                me: {},
                myConfig: {
                    welcomePageViewed: {value: '1'},
                },
            },
        })
        const component = (
            <ReduxProvider store={customStore}>
                {
                    wrapIntl(
                        <MemoryRouter initialEntries={['/?r=123']}>
                            <WelcomePage/>
                        </MemoryRouter>,
                    )
                }
            </ReduxProvider>
        )

        render(component)
        await waitFor(() => {
            expect(mockHistory.replace).toBeCalledWith('123')
        })
    })

    test('Welcome Page redirects us when we have a r query parameter with welcomePageViewed set to null', async () => {
        const localStore = mockStore({
            teams: {
                current: {id: 'team_id_1'},
            },
            users: {
                me: {
                    props: {},
                },
            },
        })

        const component = (
            <ReduxProvider store={localStore}>
                {
                    wrapIntl(
                        <MemoryRouter initialEntries={['/?r=123']}>
                            <WelcomePage/>
                        </MemoryRouter>,
                    )
                }
            </ReduxProvider>
        )
        render(component)
        const exploreButton = screen.getByText('No thanks, I\'ll figure it out myself')
        expect(exploreButton).toBeDefined()
        userEvent.click(exploreButton)
        await waitFor(() => {
            expect(mockHistory.replace).toBeCalledWith('123')
            expect(mockedMutator.patchUserConfig).toBeCalledTimes(1)
        })
    })

    test('Welcome page starts tour on clicking Take a tour button', async () => {
        const user = {} as unknown as IUser
        mockedOctoClient.getMe.mockResolvedValue(user)

        const component = (
            <ReduxProvider store={store}>
                {
                    wrapIntl(
                        <MemoryRouter>
                            <WelcomePage/>
                        </MemoryRouter>,
                    )
                }
            </ReduxProvider>
        )
        render(component)
        const exploreButton = screen.getByText('Take a tour')
        expect(exploreButton).toBeDefined()
        userEvent.click(exploreButton)
        await waitFor(() => expect(mockedOctoClient.prepareOnboarding).toBeCalledTimes(1))
        await waitFor(() => expect(mockHistory.replace).toBeCalledWith('/team/team_id_1/board_id_1'))
    })

    test('Welcome page skips tour on clicking no thanks option', async () => {
        const user = {} as unknown as IUser
        mockedOctoClient.getMe.mockResolvedValue(user)

        const component = (
            <ReduxProvider store={store}>
                {
                    wrapIntl(
                        <MemoryRouter>
                            <WelcomePage/>
                        </MemoryRouter>,
                    )
                }
            </ReduxProvider>
        )
        render(component)
        const exploreButton = screen.getByText('No thanks, I\'ll figure it out myself')
        expect(exploreButton).toBeDefined()
        userEvent.click(exploreButton)
        await waitFor(() => expect(mockHistory.replace).toBeCalledWith('/team/team_id_1'))
    })
})
