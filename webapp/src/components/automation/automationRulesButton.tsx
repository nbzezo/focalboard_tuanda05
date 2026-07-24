// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import React, {useState} from 'react'
import {useIntl} from 'react-intl'

import {Board} from '../../blocks/board'
import Button from '../../widgets/buttons/button'
import CompassIcon from '../../widgets/icons/compassIcon'

import RuleList from './ruleList'

type Props = {
    board: Board
}

const AutomationRulesButton = (props: Props): JSX.Element => {
    const intl = useIntl()
    const [showRules, setShowRules] = useState(false)

    return (
        <div className='AutomationRulesButton'>
            <Button
                title={intl.formatMessage({id: 'CenterPanel.AutomationRules', defaultMessage: 'Automation'})}
                size='medium'
                icon={<CompassIcon icon='flash-outline'/>}
                onClick={() => setShowRules(true)}
            >
                {intl.formatMessage({id: 'CenterPanel.AutomationRules', defaultMessage: 'Automation'})}
            </Button>
            {showRules &&
                <RuleList
                    board={props.board}
                    onClose={() => setShowRules(false)}
                />}
        </div>
    )
}

export default React.memo(AutomationRulesButton)
