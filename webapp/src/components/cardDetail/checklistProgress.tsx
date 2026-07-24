// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import React from 'react'
import {useIntl} from 'react-intl'

import {ContentBlock} from '../../blocks/contentBlock'
import {calculateChecklistProgress} from '../../checklistUtils'

import './checklistProgress.scss'

type Props = {
    contents: Array<ContentBlock | ContentBlock[]>
}

const ChecklistProgress = (props: Props): JSX.Element | null => {
    const intl = useIntl()
    const {total, checked} = calculateChecklistProgress(props.contents)

    if (total === 0) {
        return null
    }

    const percent = Math.round((checked / total) * 100)

    return (
        <div className='ChecklistProgress'>
            <div className='ChecklistProgress__label'>
                {intl.formatMessage(
                    {id: 'ChecklistProgress.label', defaultMessage: '{checked}/{total} checked ({percent}%)'},
                    {checked, total, percent},
                )}
            </div>
            <div className='ChecklistProgress__track'>
                <div
                    className='ChecklistProgress__fill'
                    style={{width: `${percent}%`}}
                />
            </div>
        </div>
    )
}

export default React.memo(ChecklistProgress)
