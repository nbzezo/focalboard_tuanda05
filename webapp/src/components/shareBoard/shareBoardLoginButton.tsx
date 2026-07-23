// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback} from 'react'
import {FormattedMessage} from 'react-intl'
import {generatePath} from 'react-router-dom'

import {useAppNavigation, useAppRouteMatch} from '../../routeCompat'

import Button from '../../widgets/buttons/button'
import TelemetryClient, {TelemetryActions, TelemetryCategory} from '../../telemetry/telemetryClient'
import {Utils} from '../../utils'

import './shareBoardLoginButton.scss'

const ShareBoardLoginButton = () => {
    const match = useAppRouteMatch<{teamId: string, boardId: string, viewId?: string, cardId?: string}>()
    const history = useAppNavigation()

    const pathParams = {
        teamId: match.params.teamId ?? null,
        boardId: match.params.boardId ?? null,
        viewId: match.params.viewId ?? null,
        cardId: match.params.cardId ?? null,
    }
    let redirectQueryParam = 'r=' + encodeURIComponent(generatePath('/:boardId?/:viewId?/:cardId?', pathParams))
    if (Utils.isFocalboardLegacy()) {
        redirectQueryParam = 'redirect_to=' + encodeURIComponent(generatePath('/boards/team/:teamId/:boardId?/:viewId?/:cardId?', pathParams))
    }
    const loginPath = '/login?' + redirectQueryParam

    const onLoginClick = useCallback(() => {
        TelemetryClient.trackEvent(TelemetryCategory, TelemetryActions.ShareBoardLogin)
        if (Utils.isFocalboardLegacy()) {
            location.assign(loginPath)
        } else {
            history.push(loginPath)
        }
    }, [])

    return (
        <div className='ShareBoardLoginButton'>
            <Button
                title='Login'
                size='medium'
                emphasis='primary'
                onClick={() => onLoginClick()}
            >
                <FormattedMessage
                    id='CenterPanel.Login'
                    defaultMessage='Login'
                />
            </Button>
        </div>
    )
}

export default React.memo(ShareBoardLoginButton)
