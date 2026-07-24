// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import {useMemo, useState} from 'react'
import {useIntl} from 'react-intl'

import mutator from '../../mutator'
import Editable from '../../widgets/editable'
import {PropertyProps} from '../types'

import {evaluateFormula, evaluateFormulaOrThrow} from './lib/evaluator'

import './formula.scss'

// FormulaProp doubles as both the read-only evaluated-value display (the
// normal state) and, when clicked, the formula-expression editor - this
// mirrors how a "select" property's value cell already doubles as the entry
// point for editing that property's board-wide option list, so it's
// consistent with an existing pattern rather than a one-off.
const FormulaProp = (props: PropertyProps): JSX.Element => {
    const intl = useIntl()
    const {card, board, propertyTemplate, readOnly, showEmptyPlaceholder} = props

    const [editing, setEditing] = useState(false)
    const [draftFormula, setDraftFormula] = useState(propertyTemplate.formula || '')

    const evaluated = evaluateFormula(propertyTemplate.formula || '', card, board.cardProperties)
    const displayValue = evaluated === undefined ? '' : String(evaluated)

    const parseError = useMemo(() => {
        if (!draftFormula.trim()) {
            return undefined
        }
        try {
            evaluateFormulaOrThrow(draftFormula, card, board.cardProperties)
            return undefined
        } catch (e) {
            return (e as Error).message
        }
    }, [draftFormula, card, board.cardProperties])

    if (readOnly || !editing) {
        const emptyDisplayValue = showEmptyPlaceholder ? intl.formatMessage({id: 'PropertyValueElement.empty', defaultMessage: 'Empty'}) : ''
        return (
            <div
                className={props.property.valueClassName(readOnly)}
                onClick={() => {
                    if (readOnly) {
                        return
                    }
                    setDraftFormula(propertyTemplate.formula || '')
                    setEditing(true)
                }}
            >
                {displayValue || emptyDisplayValue}
            </div>
        )
    }

    const validate = (value: string): boolean => {
        if (!value.trim()) {
            return true
        }
        try {
            evaluateFormulaOrThrow(value, card, board.cardProperties)
            return true
        } catch {
            return false
        }
    }

    const save = () => {
        if (parseError) {
            return
        }
        if (draftFormula !== (propertyTemplate.formula || '')) {
            mutator.changePropertyFormula(board.id, board.cardProperties, propertyTemplate, draftFormula)
        }
        setEditing(false)
    }

    return (
        <div className='FormulaProp'>
            <Editable
                className={props.property.valueClassName(false)}
                value={draftFormula}
                placeholderText={intl.formatMessage({id: 'Formula.placeholder', defaultMessage: 'e.g. if(prop("Status") == "Done", "Yes", "No")'})}
                onChange={setDraftFormula}
                onSave={save}
                onCancel={() => setEditing(false)}
                validator={validate}
                autoExpand={true}
            />
            {parseError && <div className='FormulaProp__error'>{parseError}</div>}
        </div>
    )
}

export default FormulaProp
