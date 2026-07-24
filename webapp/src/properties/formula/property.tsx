// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import {IntlShape} from 'react-intl'

import {Options} from '../../components/calculations/options'
import {FilterValueType, PropertyType, PropertyTypeEnum} from '../types'

import FormulaProp from './formula'

export default class FormulaProperty extends PropertyType {
    Editor = FormulaProp
    name = 'Formula'
    type = 'formula' as PropertyTypeEnum
    displayName = (intl: IntlShape) => intl.formatMessage({id: 'PropertyType.Formula', defaultMessage: 'Formula'})
    canFilter = true
    filterValueType: FilterValueType = 'text'

    // Formula values are computed per-card at render time, not a fixed set of
    // options like select/multiSelect - grouping needs a bounded option list,
    // so canGroup stays false (the base class default), same as number/text/
    // url/email/phone. This also means boardUtils.ts's groupCardsByOptions
    // never actually receives a formula-type groupByProperty in practice: the
    // "Group by" picker already filters on canGroup.
    calculationOptions = [Options.none, Options.count, Options.countEmpty,
        Options.countNotEmpty, Options.percentEmpty, Options.percentNotEmpty,
        Options.countValue, Options.countUniqueValue]

    // NOTE: displayValue/exportValue are intentionally NOT overridden here.
    // PropertyType.displayValue's signature is (value, card, template, intl)
    // - it has no way to receive the full board.cardProperties list a formula
    // needs to resolve prop("Other property") references, and widening that
    // signature would touch every property type in webapp/src/properties.
    // The real evaluation path (properties/formula/lib/evaluator.ts's
    // evaluateFormula(formula, card, templates)) is used directly wherever
    // the caller already has the full template list: the card's own value
    // display (formula.tsx), sorting (store/cards.ts), and filtering
    // (cardFilter.ts). CSV export of a formula column is the one place that
    // falls back to the base class's default (blank) behavior as a result -
    // a narrow, documented limitation rather than a silent gap.
}
