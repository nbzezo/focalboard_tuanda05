// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import {MutableRefObject} from 'react'

import {Extension} from '@tiptap/core'
import {PluginKey} from '@tiptap/pm/state'
import createSuggestionPlugin from '@tiptap/suggestion'

import {Board, BoardTypeOpen} from '../../blocks/board'
import {ClientConfig} from '../../config/clientConfig'
import octoClient from '../../octoClient'
import {IUser} from '../../user'
import {Utils} from '../../utils'

import MentionList, {MentionUser} from './mentionList'
import {createSuggestionRender} from './suggestionRender'

const imageURLForUser = (window as any).Components?.imageURLForUser

export type MentionSearchContext = {
    board: Board
    boardUsers: IUser[]
    clientConfig: ClientConfig
    allowManageBoardRoles: boolean
    me: IUser | null
}

// Mirrors the old @draft-js-plugins/mention search behaviour: board admins
// (or open boards) can search the whole team via the API; everyone else can
// only mention existing board members.
export async function loadMentionSuggestions(query: string, ctx: MentionSearchContext): Promise<MentionUser[]> {
    let users: IUser[]

    if (!ctx.me?.is_guest && (ctx.allowManageBoardRoles || (ctx.board && ctx.board.type === BoardTypeOpen))) {
        const excludeBots = true
        users = await octoClient.searchTeamUsers(query, excludeBots)
    } else {
        users = ctx.boardUsers.
            filter((user) => {
                if (!query) {
                    return true
                }
                return Utils.getUserDisplayName(user, ctx.clientConfig.teammateNameDisplay).includes(query)
            }).
            slice(0, 10)
    }

    return users.map((user): MentionUser => ({
        user,
        username: user.username,
        avatar: `${imageURLForUser ? imageURLForUser(user.id) : ''}`,
        is_bot: user.is_bot,
        is_guest: user.is_guest,
        displayName: Utils.getUserDisplayName(user, ctx.clientConfig.teammateNameDisplay),
        isBoardMember: Boolean(ctx.boardUsers.find((u) => u.id === user.id)),
    }))
}

// Mirrors the old @draft-js-plugins/mention behaviour: typing "@" opens a
// user search, and selecting a result inserts "@username" as plain text (the
// same literal characters the old plugin's plain-text representation used),
// so it round trips through markdown storage with zero special handling.
// When the selected user isn't a board member, the caller is asked (via
// onNeedsConfirmAddUser) to show the "add to board" confirmation -- same
// product behaviour as before, just triggered from the suggestion's command
// instead of a mention-entity's onAddMention callback.
export function createMentionExtension(
    contextRef: MutableRefObject<MentionSearchContext>,
    onNeedsConfirmAddUser: (user: IUser) => void,
) {
    return Extension.create({
        name: 'mentionSuggestion',

        addProseMirrorPlugins() {
            return [
                createSuggestionPlugin<MentionUser, MentionUser>({
                    editor: this.editor,
                    pluginKey: new PluginKey('mentionSuggestion'),
                    char: '@',
                    allowSpaces: false,
                    items: ({query}) => loadMentionSuggestions(query, contextRef.current),
                    command: ({editor, range, props}) => {
                        editor.chain().focus().insertContentAt(range, `@${props.username} `).run()
                        if (!props.isBoardMember) {
                            onNeedsConfirmAddUser(props.user)
                        }
                    },
                    render: createSuggestionRender(MentionList),
                }),
            ]
        },
    })
}
