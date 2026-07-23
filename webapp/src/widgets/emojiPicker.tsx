// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import {FC} from 'react'

import data from '@emoji-mart/data'
import Picker from '@emoji-mart/react'

import './emojiPicker.scss'

type Props = {
    onSelect: (emoji: string) => void
}

const EmojiPicker: FC<Props> = (props: Props): JSX.Element => (
    <div
        className='EmojiPicker'
        onClick={(e) => e.stopPropagation()}
    >
        <Picker
            data={data}
            onEmojiSelect={(emoji: {native: string}) => props.onSelect(emoji.native)}
        />
    </div>
)

export default EmojiPicker
