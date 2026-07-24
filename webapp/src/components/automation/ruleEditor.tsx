// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import React, {useState} from 'react'
import {useIntl} from 'react-intl'

import {Board} from '../../blocks/board'
import {AutomationAction, AutomationActionType, AutomationRule, AutomationTriggerType} from '../../automation'
import {useAppDispatch} from '../../store/hooks'
import {saveAutomationRule} from '../../store/automationRules'
import Dialog from '../dialog'
import Button from '../../widgets/buttons/button'

import './ruleEditor.scss'

type Props = {
    board: Board
    rule: AutomationRule
    onClose: () => void
}

const triggerTypes: AutomationTriggerType[] = ['card-created', 'property-changed', 'moved-to-group', 'checklist-completed', 'dependency-unblocked']
const actionTypes: AutomationActionType[] = ['set-property', 'move-to-group', 'add-comment', 'notify-user']

function triggerNeedsProperty(triggerType: AutomationTriggerType): boolean {
    return triggerType === 'property-changed' || triggerType === 'moved-to-group' || triggerType === 'dependency-unblocked'
}

function newAction(type: AutomationActionType): AutomationAction {
    return {type, config: {}}
}

const RuleEditor = (props: Props): JSX.Element => {
    const intl = useIntl()
    const dispatch = useAppDispatch()
    const [rule, setRule] = useState<AutomationRule>(props.rule)
    const [saving, setSaving] = useState(false)

    const setTriggerConfigField = (key: string, value: unknown) => {
        setRule({...rule, triggerConfig: {...rule.triggerConfig, [key]: value}})
    }

    const setAction = (index: number, action: AutomationAction) => {
        const actions = rule.actions.slice()
        actions[index] = action
        setRule({...rule, actions})
    }

    const removeAction = (index: number) => {
        setRule({...rule, actions: rule.actions.filter((_, i) => i !== index)})
    }

    const addAction = () => {
        setRule({...rule, actions: [...rule.actions, newAction('set-property')]})
    }

    const handleSave = async () => {
        setSaving(true)
        await dispatch(saveAutomationRule({boardId: props.board.id, rule}))
        setSaving(false)
        props.onClose()
    }

    const canSave = rule.name.trim() !== '' && rule.actions.length > 0

    return (
        <Dialog
            title={<>{intl.formatMessage({id: 'RuleEditor.title', defaultMessage: 'Automation rule'})}</>}
            className='RuleEditor'
            onClose={props.onClose}
        >
            <div className='RuleEditor__field'>
                <label htmlFor='RuleEditor__name'>{intl.formatMessage({id: 'RuleEditor.name', defaultMessage: 'Name'})}</label>
                <input
                    id='RuleEditor__name'
                    type='text'
                    value={rule.name}
                    onChange={(e) => setRule({...rule, name: e.target.value})}
                />
            </div>

            <div className='RuleEditor__field'>
                <label>
                    <input
                        type='checkbox'
                        checked={rule.enabled}
                        onChange={(e) => setRule({...rule, enabled: e.target.checked})}
                    />
                    {intl.formatMessage({id: 'RuleEditor.enabled', defaultMessage: 'Enabled'})}
                </label>
            </div>

            <div className='RuleEditor__field'>
                <label htmlFor='RuleEditor__when'>{intl.formatMessage({id: 'RuleEditor.when', defaultMessage: 'When'})}</label>
                <select
                    id='RuleEditor__when'
                    value={rule.triggerType}
                    onChange={(e) => setRule({...rule, triggerType: e.target.value as AutomationTriggerType, triggerConfig: {}})}
                >
                    {triggerTypes.map((t) => (
                        <option
                            key={t}
                            value={t}
                        >
                            {intl.formatMessage({id: `RuleEditor.trigger.${t}`, defaultMessage: t})}
                        </option>
                    ))}
                </select>
            </div>

            {triggerNeedsProperty(rule.triggerType) &&
                <div className='RuleEditor__field'>
                    <label htmlFor='RuleEditor__triggerProperty'>{intl.formatMessage({id: 'RuleEditor.property', defaultMessage: 'Property'})}</label>
                    <select
                        id='RuleEditor__triggerProperty'
                        value={(rule.triggerConfig.propertyId as string) || ''}
                        onChange={(e) => setTriggerConfigField('propertyId', e.target.value)}
                    >
                        <option value=''>{intl.formatMessage({id: 'RuleEditor.selectProperty', defaultMessage: 'Select a property'})}</option>
                        {props.board.cardProperties.map((p) => (
                            <option
                                key={p.id}
                                value={p.id}
                            >
                                {p.name}
                            </option>
                        ))}
                    </select>
                </div>}

            {rule.triggerType === 'property-changed' &&
                <div className='RuleEditor__field'>
                    <label htmlFor='RuleEditor__toValue'>{intl.formatMessage({id: 'RuleEditor.toValueOptional', defaultMessage: 'To value (optional)'})}</label>
                    <input
                        id='RuleEditor__toValue'
                        type='text'
                        value={(rule.triggerConfig.toValue as string) || ''}
                        onChange={(e) => setTriggerConfigField('toValue', e.target.value)}
                    />
                </div>}

            {rule.triggerType === 'dependency-unblocked' &&
                <div className='RuleEditor__field'>
                    <label htmlFor='RuleEditor__doneValue'>{intl.formatMessage({id: 'RuleEditor.doneValue', defaultMessage: '"Done" value'})}</label>
                    <input
                        id='RuleEditor__doneValue'
                        type='text'
                        value={(rule.triggerConfig.doneValue as string) || ''}
                        onChange={(e) => setTriggerConfigField('doneValue', e.target.value)}
                    />
                </div>}

            <div className='RuleEditor__actions-header'>
                <label>{intl.formatMessage({id: 'RuleEditor.then', defaultMessage: 'Then'})}</label>
                <Button onClick={addAction}>
                    {intl.formatMessage({id: 'RuleEditor.addAction', defaultMessage: '+ Add action'})}
                </Button>
            </div>

            {rule.actions.map((action, index) => (
                <div
                    // eslint-disable-next-line react/no-array-index-key
                    key={index}
                    className='RuleEditor__action'
                >
                    <select
                        value={action.type}
                        onChange={(e) => setAction(index, newAction(e.target.value as AutomationActionType))}
                    >
                        {actionTypes.map((t) => (
                            <option
                                key={t}
                                value={t}
                            >
                                {intl.formatMessage({id: `RuleEditor.action.${t}`, defaultMessage: t})}
                            </option>
                        ))}
                    </select>

                    {(action.type === 'set-property' || action.type === 'move-to-group') &&
                        <>
                            <select
                                value={(action.config.propertyId as string) || ''}
                                onChange={(e) => setAction(index, {...action, config: {...action.config, propertyId: e.target.value}})}
                            >
                                <option value=''>{intl.formatMessage({id: 'RuleEditor.selectProperty', defaultMessage: 'Select a property'})}</option>
                                {props.board.cardProperties.map((p) => (
                                    <option
                                        key={p.id}
                                        value={p.id}
                                    >
                                        {p.name}
                                    </option>
                                ))}
                            </select>
                            <input
                                type='text'
                                placeholder={intl.formatMessage({id: 'RuleEditor.value', defaultMessage: 'Value'})}
                                value={(action.config.value as string) || ''}
                                onChange={(e) => setAction(index, {...action, config: {...action.config, value: e.target.value}})}
                            />
                        </>}

                    {action.type === 'add-comment' &&
                        <input
                            type='text'
                            placeholder={intl.formatMessage({id: 'RuleEditor.messageTemplate', defaultMessage: 'Message ({{card.title}} is supported)'})}
                            value={(action.config.message as string) || ''}
                            onChange={(e) => setAction(index, {...action, config: {...action.config, message: e.target.value}})}
                        />}

                    {action.type === 'notify-user' &&
                        <>
                            <input
                                type='text'
                                placeholder={intl.formatMessage({id: 'RuleEditor.userId', defaultMessage: 'User ID'})}
                                value={(action.config.userId as string) || ''}
                                onChange={(e) => setAction(index, {...action, config: {...action.config, userId: e.target.value}})}
                            />
                            <input
                                type='text'
                                placeholder={intl.formatMessage({id: 'RuleEditor.messageTemplate', defaultMessage: 'Message ({{card.title}} is supported)'})}
                                value={(action.config.message as string) || ''}
                                onChange={(e) => setAction(index, {...action, config: {...action.config, message: e.target.value}})}
                            />
                        </>}

                    <Button onClick={() => removeAction(index)}>
                        {intl.formatMessage({id: 'RuleEditor.removeAction', defaultMessage: 'Remove'})}
                    </Button>
                </div>
            ))}

            <div className='RuleEditor__footer'>
                <Button
                    filled={true}
                    disabled={!canSave || saving}
                    onClick={handleSave}
                >
                    {intl.formatMessage({id: 'RuleEditor.save', defaultMessage: 'Save'})}
                </Button>
            </div>
        </Dialog>
    )
}

export default React.memo(RuleEditor)
