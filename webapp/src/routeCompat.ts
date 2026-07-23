// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import {useContext, useMemo} from 'react'
// eslint-disable-next-line camelcase
import {matchPath, UNSAFE_LocationContext, UNSAFE_NavigationContext} from 'react-router-dom'

// Compatibility helpers for the react-router v5 -> v6 migration.
//
// v6 removed useHistory/useRouteMatch. The codebase relies on
// `match.path` (the matched route PATTERN, fed into generatePath) and a
// history object with push/replace/goBack. These hooks provide both with
// the v5 shapes so call sites stay unchanged.
//
// The hooks read router context defensively (UNSAFE_* contexts) instead of
// useLocation()/useNavigate(), so a component rendered outside a <Router>
// (common in unit tests) gets a safe default rather than throwing. In the
// real app everything is inside <BrowserRouter>, so behaviour is unchanged.

// App route patterns, most specific first. Must stay in sync with the
// <Routes> declared in router.tsx.
const routePatterns = [
    '/error',
    '/login',
    '/register',
    '/change_password',
    '/team/:teamId/new/:channelId',
    '/team/:teamId/shared/:boardId?/:viewId?/:cardId?',
    '/shared/:boardId?/:viewId?/:cardId?',
    '/board/:boardId?/:viewId?/:cardId?',
    '/workspace/:workspaceId/shared/:boardId?/:viewId?/:cardId?',
    '/workspace/:workspaceId/:boardId?/:viewId?/:cardId?',
    '/team/:teamId/:boardId?/:viewId?/:cardId?',
    '/:boardId?/:viewId?/:cardId?',
]

export type AppRouteParams = Record<string, string | undefined>

export type AppRouteMatch<P extends AppRouteParams = AppRouteParams> = {
    params: P
    path: string
    url: string
}

// v5 useRouteMatch equivalent: matches the current location against the
// app's known route patterns.
export function useAppRouteMatch<P extends AppRouteParams = AppRouteParams>(): AppRouteMatch<P> {
    // eslint-disable-next-line camelcase
    const locationContext = useContext(UNSAFE_LocationContext)
    const pathname = locationContext?.location?.pathname ?? '/'
    return useMemo(() => {
        for (const pattern of routePatterns) {
            const match = matchPath({path: pattern, end: true}, pathname)
            if (match) {
                return {
                    params: match.params as P,
                    path: pattern,
                    url: pathname,
                }
            }
        }
        return {params: {} as P, path: '', url: pathname}
    }, [pathname])
}

export type AppHistory = {
    push: (to: string) => void
    replace: (to: string) => void
    goBack: () => void
}

// v5 useHistory equivalent backed by the v6 router's navigator. We read the
// navigator from context directly (rather than useNavigate) so it never
// throws outside a <Router>. All `to` values in this app are absolute paths,
// so the raw navigator.push/replace/go are sufficient.
export function useAppNavigation(): AppHistory {
    // eslint-disable-next-line camelcase
    const navigationContext = useContext(UNSAFE_NavigationContext)
    return useMemo(() => {
        const navigator = navigationContext?.navigator
        if (!navigator) {
            // Outside a <Router> (e.g. bare unit test) — no-op navigation.
            return {push: () => {}, replace: () => {}, goBack: () => {}}
        }
        return {
            push: (to: string) => navigator.push(to),
            replace: (to: string) => navigator.replace(to),
            goBack: () => navigator.go(-1),
        }
    }, [navigationContext])
}
