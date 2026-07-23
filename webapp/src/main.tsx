// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import {createRoot} from 'react-dom/client'
import {Provider as ReduxProvider} from 'react-redux'

import App from './app'
import {initThemes} from './theme'
import {importNativeAppSettings} from './nativeApp'

import {IUser} from './user'
import {getMe} from './store/users'
import {useAppSelector} from './store/hooks'

import '@mattermost/compass-icons/css/compass-icons.css'

import './styles/variables.scss'
import './styles/main.scss'
import './styles/labels.scss'
import './styles/_markdown.scss'

import store from './store'
import WithWebSockets from './components/withWebSockets'

importNativeAppSettings()

initThemes()

const MainApp = () => {
    const me = useAppSelector<IUser|null>(getMe)

    return (
        <WithWebSockets userId={me?.id}>
            <App/>
        </WithWebSockets>
    )
}

const rootElement = document.getElementById('focalboard-app')
if (!rootElement) {
    throw new Error('focalboard-app root element not found')
}
createRoot(rootElement).render(
    <ReduxProvider store={store}>
        <MainApp/>
    </ReduxProvider>,
)
