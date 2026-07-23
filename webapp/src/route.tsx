// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import React from 'react'
import {Navigate, useParams} from 'react-router-dom'

import {Utils} from './utils'
import {getLoggedIn} from './store/users'
import {useAppSelector} from './store/hooks'

type Props = {
    children: React.ReactNode
    getOriginalPath?: (match: {params: Record<string, string | undefined>}) => string
    loginRequired?: boolean
}

// Login guard used by the route elements in router.tsx (the v6 replacement
// for the old FBRoute wrapper around v5 <Route>).
function FBRouteGuard(props: Props): React.ReactElement {
    const loggedIn = useAppSelector<boolean|null>(getLoggedIn)
    const params = useParams()

    if (loggedIn === false && props.loginRequired) {
        if (props.getOriginalPath) {
            let redirectUrl = '/' + Utils.buildURL(props.getOriginalPath({params}))
            if (redirectUrl.indexOf('//') === 0) {
                redirectUrl = redirectUrl.slice(1)
            }
            const loginUrl = `/error?id=not-logged-in&r=${encodeURIComponent(redirectUrl)}`
            return (
                <Navigate
                    to={loginUrl}
                    replace={true}
                />
            )
        }
        return (
            <Navigate
                to='/error?id=not-logged-in'
                replace={true}
            />
        )
    }

    return <>{props.children}</>
}

export default React.memo(FBRouteGuard)
