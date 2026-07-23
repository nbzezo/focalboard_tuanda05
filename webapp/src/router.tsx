// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import React, {useEffect} from 'react'
import {
    BrowserRouter,
    Route,
    Routes,
    generatePath,
    useLocation,
} from 'react-router-dom'

import BoardPage from './pages/boardPage/boardPage'
import ChangePasswordPage from './pages/changePasswordPage'
import ErrorPage from './pages/errorPage'
import LoginPage from './pages/loginPage'
import RegisterPage from './pages/registerPage'
import {Utils} from './utils'
import octoClient from './octoClient'
import {setGlobalError, getGlobalError} from './store/globalError'
import {useAppSelector, useAppDispatch} from './store/hooks'
import {useAppNavigation, useAppRouteMatch} from './routeCompat'
import FBRouteGuard from './route'

const UUID_REGEX = new RegExp(/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/)

function WorkspaceToTeamRedirect() {
    const match = useAppRouteMatch<{boardId: string, viewId: string, cardId?: string, workspaceId?: string}>()
    const queryParams = new URLSearchParams(useLocation().search)
    const history = useAppNavigation()
    useEffect(() => {
        octoClient.getBoard(match.params.boardId).then((board) => {
            if (board) {
                let newPath = generatePath(match.path.replace('/workspace/:workspaceId', '/team/:teamId'), {
                    teamId: board?.teamId,
                    boardId: board?.id,
                    viewId: match.params.viewId,
                    cardId: match.params.cardId,
                })
                if (queryParams) {
                    newPath += '?' + queryParams
                }
                history.replace(newPath)
            }
        })
    }, [])
    return null
}

function GlobalErrorRedirect() {
    const globalError = useAppSelector<string>(getGlobalError)
    const dispatch = useAppDispatch()
    const history = useAppNavigation()

    useEffect(() => {
        if (globalError) {
            dispatch(setGlobalError(''))
            history.replace(`/error?id=${globalError}`)
        }
    }, [globalError, history])

    return null
}

const boardOriginalPath = ({params: {boardId, viewId, cardId}}: {params: Record<string, string | undefined>}) => {
    return `/board/${Utils.buildOriginalPath('', boardId, viewId, cardId)}`
}

const teamOriginalPath = ({params: {teamId, boardId, viewId, cardId}}: {params: Record<string, string | undefined>}) => {
    return `/team/${Utils.buildOriginalPath(teamId, boardId, viewId, cardId)}`
}

const rootOriginalPath = ({params: {boardId, viewId, cardId}}: {params: Record<string, string | undefined>}) => {
    const boardIdIsValidUUIDV4 = UUID_REGEX.test(boardId || '')
    if (boardIdIsValidUUIDV4) {
        return `/${Utils.buildOriginalPath('', boardId, viewId, cardId)}`
    }
    return ''
}

const FocalboardRouter = (): JSX.Element => {
    return (
        <BrowserRouter basename={Utils.getFrontendBaseURL()}>
            <GlobalErrorRedirect/>
            <Routes>
                <Route
                    path='/error'
                    element={<ErrorPage/>}
                />
                <Route
                    path='/login'
                    element={<LoginPage/>}
                />
                <Route
                    path='/register'
                    element={<RegisterPage/>}
                />
                <Route
                    path='/change_password'
                    element={<ChangePasswordPage/>}
                />
                <Route
                    path='/team/:teamId/new/:channelId'
                    element={<BoardPage new={true}/>}
                />
                <Route
                    path='/team/:teamId/shared/:boardId?/:viewId?/:cardId?'
                    element={<BoardPage readonly={true}/>}
                />
                <Route
                    path='/shared/:boardId?/:viewId?/:cardId?'
                    element={<BoardPage readonly={true}/>}
                />
                <Route
                    path='/board/:boardId?/:viewId?/:cardId?'
                    element={
                        <FBRouteGuard
                            loginRequired={true}
                            getOriginalPath={boardOriginalPath}
                        >
                            <BoardPage/>
                        </FBRouteGuard>
                    }
                />
                <Route
                    path='/workspace/:workspaceId/shared/:boardId?/:viewId?/:cardId?'
                    element={<WorkspaceToTeamRedirect/>}
                />
                <Route
                    path='/workspace/:workspaceId/:boardId?/:viewId?/:cardId?'
                    element={<WorkspaceToTeamRedirect/>}
                />
                <Route
                    path='/team/:teamId/:boardId?/:viewId?/:cardId?'
                    element={
                        <FBRouteGuard
                            loginRequired={true}
                            getOriginalPath={teamOriginalPath}
                        >
                            <BoardPage/>
                        </FBRouteGuard>
                    }
                />
                <Route
                    path='/:boardId?/:viewId?/:cardId?'
                    element={
                        <FBRouteGuard
                            loginRequired={true}
                            getOriginalPath={rootOriginalPath}
                        >
                            <BoardPage/>
                        </FBRouteGuard>
                    }
                />
            </Routes>
        </BrowserRouter>
    )
}

export default React.memo(FocalboardRouter)
