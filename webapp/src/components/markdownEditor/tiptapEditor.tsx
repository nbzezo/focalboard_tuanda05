// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import {ReactElement, useEffect, useMemo, useRef, useState} from 'react'

import {getSchema} from '@tiptap/core'
import {EditorContent, useEditor} from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'

import {useAppSelector} from '../../store/hooks'
import {IUser} from '../../user'
import {getBoardUsersList, getMe} from '../../store/users'
import {useHasPermissions} from '../../hooks/permissions'
import {Permission} from '../../constants'
import {BoardMember, MemberRole} from '../../blocks/board'
import mutator from '../../mutator'
import ConfirmAddUserForNotifications from '../confirmAddUserForNotifications'
import RootPortal from '../rootPortal'

import {getCurrentBoard} from '../../store/boards'
import {ClientConfig} from '../../config/clientConfig'
import {getClientConfig} from '../../store/clientConfig'

import EmojiSuggestion from './emojiExtension'
import {createMarkdownParser, createMarkdownSerializer} from './markdownBridge'
import {createMentionExtension, MentionSearchContext} from './mentionExtension'

import './tiptapEditor.scss'

type Props = {
    onChange?: (text: string) => void
    onFocus?: () => void
    onBlur?: (text: string) => void
    onEditorCancel?: () => void
    initialText?: string
    id?: string
    isEditing: boolean
    saveOnEnter?: boolean
}

const TiptapEditor = (props: Props): ReactElement => {
    const {initialText, id} = props
    const boardUsers = useAppSelector<IUser[]>(getBoardUsersList)
    const board = useAppSelector(getCurrentBoard)
    const clientConfig = useAppSelector<ClientConfig>(getClientConfig)
    const allowManageBoardRoles = useHasPermissions(board.teamId, board.id, [Permission.ManageBoardRoles])
    const [confirmAddUser, setConfirmAddUser] = useState<IUser|null>(null)
    const me = useAppSelector<IUser|null>(getMe)

    // Read by the mention extension's items() at query time, so the search
    // always sees fresh board/user context without recreating the editor
    // (which would reset cursor position and undo history) on every render.
    const mentionContextRef = useRef<MentionSearchContext>({board, boardUsers, clientConfig, allowManageBoardRoles, me})
    mentionContextRef.current = {board, boardUsers, clientConfig, allowManageBoardRoles, me}

    // Read by handleKeyDown below, for the same reason.
    const propsRef = useRef(props)
    propsRef.current = props

    const confirmAddUserRef = useRef<IUser|null>(null)
    confirmAddUserRef.current = confirmAddUser

    const extensions = useMemo(() => [
        StarterKit.configure({
            link: {openOnClick: false},
        }),
        createMentionExtension(mentionContextRef, (user) => setConfirmAddUser(user)),
        EmojiSuggestion,
    ], [])

    // The schema (and therefore the markdown parser, which is schema-bound)
    // only depends on the extensions list, which never changes after first
    // render. The serializer is schema-agnostic.
    const {markdownParser, markdownSerializer} = useMemo(() => {
        const schema = getSchema(extensions)
        return {markdownParser: createMarkdownParser(schema), markdownSerializer: createMarkdownSerializer()}
    }, [])

    const commitBlur = () => {
        if (confirmAddUserRef.current) {
            return
        }
        const markdown = editor ? markdownSerializer.serialize(editor.state.doc) : ''
        propsRef.current.onBlur?.(markdown)
    }

    const editor = useEditor({
        extensions,
        content: markdownParser.parse(initialText || '').toJSON(),
        onUpdate: ({editor: updatedEditor}) => {
            propsRef.current.onChange?.(markdownSerializer.serialize(updatedEditor.state.doc))
        },
        onFocus: () => {
            propsRef.current.onFocus?.()
        },
        onBlur: () => {
            commitBlur()
        },
        editorProps: {
            attributes: {
                class: 'TiptapEditorInput',
            },
            handleKeyDown: (view, event) => {
                if (event.key === 'Escape') {
                    view.dom.blur()
                    return true
                }

                if (event.key === 'Backspace') {
                    if (propsRef.current.onEditorCancel && view.state.doc.textContent.length === 0) {
                        propsRef.current.onEditorCancel()
                        return true
                    }
                    return false
                }

                if (event.key === 'Enter' && !event.shiftKey && propsRef.current.saveOnEnter) {
                    commitBlur()
                    return true
                }

                return false
            },
        },
    }, [])

    // Sync externally-changed content (e.g. once the board/card data finishes
    // loading) into the editor, but never clobber content the user is
    // actively editing.
    useEffect(() => {
        if (!editor || editor.isFocused) {
            return
        }
        const current = markdownSerializer.serialize(editor.state.doc)
        if (initialText !== undefined && initialText !== current) {
            editor.commands.setContent(markdownParser.parse(initialText), {emitUpdate: false})
        }
    }, [initialText, editor])

    return (
        <div
            className='TiptapEditor'
            data-testid={id}
        >
            <EditorContent editor={editor}/>
            {confirmAddUser &&
                <RootPortal>
                    <ConfirmAddUserForNotifications
                        allowManageBoardRoles={allowManageBoardRoles}
                        minimumRole={board.minimumRole}
                        user={confirmAddUser}
                        onConfirm={async (userId: string, role: string) => {
                            const newRole = role || MemberRole.Viewer
                            const newMember = {
                                boardId: board.id,
                                userId,
                                roles: role,
                                schemeAdmin: newRole === MemberRole.Admin,
                                schemeEditor: newRole === MemberRole.Admin || newRole === MemberRole.Editor,
                                schemeCommenter: newRole === MemberRole.Admin || newRole === MemberRole.Editor || newRole === MemberRole.Commenter,
                                schemeViewer: newRole === MemberRole.Admin || newRole === MemberRole.Editor || newRole === MemberRole.Commenter || newRole === MemberRole.Viewer,
                            } as BoardMember

                            setConfirmAddUser(null)
                            editor?.commands.focus('end')
                            await mutator.createBoardMember(newMember)
                        }}
                        onClose={() => {
                            setConfirmAddUser(null)
                            editor?.commands.focus('end')
                        }}
                    />
                </RootPortal>}
        </div>
    )
}

export default TiptapEditor
