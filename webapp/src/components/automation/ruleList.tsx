// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import React, {useEffect, useState} from 'react'
import {useIntl} from 'react-intl'

import {Board} from '../../blocks/board'
import {AutomationRule, createAutomationRule} from '../../automation'
import {useAppDispatch, useAppSelector} from '../../store/hooks'
import {fetchAutomationRules, getAutomationRules, removeAutomationRule} from '../../store/automationRules'
import Dialog from '../dialog'
import Button from '../../widgets/buttons/button'

import RuleEditor from './ruleEditor'

import './ruleList.scss'

type Props = {
    board: Board
    onClose: () => void
}

const RuleList = (props: Props): JSX.Element => {
    const intl = useIntl()
    const dispatch = useAppDispatch()
    const rules = useAppSelector(getAutomationRules(props.board.id))
    const [editingRule, setEditingRule] = useState<AutomationRule | null>(null)

    useEffect(() => {
        dispatch(fetchAutomationRules(props.board.id))
    }, [props.board.id, dispatch])

    const handleDelete = (rule: AutomationRule) => {
        dispatch(removeAutomationRule({boardId: props.board.id, ruleId: rule.id}))
    }

    if (editingRule) {
        return (
            <RuleEditor
                board={props.board}
                rule={editingRule}
                onClose={() => setEditingRule(null)}
            />
        )
    }

    return (
        <Dialog
            title={<>{intl.formatMessage({id: 'RuleList.title', defaultMessage: 'Automation rules'})}</>}
            className='RuleList'
            onClose={props.onClose}
        >
            {rules.length === 0 &&
                <div className='RuleList__empty'>
                    {intl.formatMessage({id: 'RuleList.empty', defaultMessage: 'No automation rules yet'})}
                </div>}

            {rules.map((rule) => (
                <div
                    key={rule.id}
                    className='RuleList__row'
                >
                    <div className='RuleList__name'>
                        {rule.name}
                        {!rule.enabled &&
                            <span className='RuleList__disabled-badge'>
                                {intl.formatMessage({id: 'RuleList.disabled', defaultMessage: 'Disabled'})}
                            </span>}
                    </div>
                    <div className='RuleList__row-actions'>
                        <Button onClick={() => setEditingRule(rule)}>
                            {intl.formatMessage({id: 'RuleList.edit', defaultMessage: 'Edit'})}
                        </Button>
                        <Button onClick={() => handleDelete(rule)}>
                            {intl.formatMessage({id: 'RuleList.delete', defaultMessage: 'Delete'})}
                        </Button>
                    </div>
                </div>
            ))}

            <div className='RuleList__footer'>
                <Button
                    filled={true}
                    onClick={() => setEditingRule({...createAutomationRule(), boardId: props.board.id})}
                >
                    {intl.formatMessage({id: 'RuleList.new', defaultMessage: '+ New rule'})}
                </Button>
            </div>
        </Dialog>
    )
}

export default React.memo(RuleList)
