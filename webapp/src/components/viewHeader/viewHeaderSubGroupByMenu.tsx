// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react'
import {FormattedMessage, useIntl} from 'react-intl'

import {IPropertyTemplate} from '../../blocks/board'
import {BoardView} from '../../blocks/boardView'
import mutator from '../../mutator'
import Button from '../../widgets/buttons/button'
import Menu from '../../widgets/menu'
import MenuWrapper from '../../widgets/menuWrapper'
import CheckIcon from '../../widgets/icons/check'

type Props = {
    properties: readonly IPropertyTemplate[]
    activeView: BoardView
    groupByProperty?: IPropertyTemplate
    swimlaneByProperty?: IPropertyTemplate
}

const ViewHeaderSubGroupByMenu = (props: Props) => {
    const {properties, activeView, groupByProperty, swimlaneByProperty} = props
    const intl = useIntl()
    const noneLabel = intl.formatMessage({id: 'ViewHeader.sub-group-by-none', defaultMessage: 'None'})

    // Sub-grouping only supports select-type properties (the same simple
    // option-based grouping groupCardsTwoLevels uses); person/createdBy/
    // updatedBy grouping uses a different mechanism and isn't supported here.
    const eligibleProperties = properties.filter((o) => o.type === 'select' && o.id !== groupByProperty?.id)

    return (
        <MenuWrapper>
            <Button>
                <FormattedMessage
                    id='ViewHeader.sub-group-by'
                    defaultMessage='Sub-group by: {property}'
                    values={{
                        property: swimlaneByProperty?.name || noneLabel,
                    }}
                />
            </Button>
            <Menu>
                <Menu.Text
                    key={'none'}
                    id={''}
                    name={noneLabel}
                    rightIcon={activeView.fields.swimlaneById ? undefined : <CheckIcon/>}
                    onClick={(id) => {
                        if (!activeView.fields.swimlaneById) {
                            return
                        }
                        mutator.changeViewSwimlaneById(activeView.boardId, activeView.id, activeView.fields.swimlaneById, id)
                    }}
                />
                {eligibleProperties.map((option: IPropertyTemplate) => (
                    <Menu.Text
                        key={option.id}
                        id={option.id}
                        name={option.name}
                        rightIcon={swimlaneByProperty?.id === option.id ? <CheckIcon/> : undefined}
                        onClick={(id) => {
                            if (activeView.fields.swimlaneById === id) {
                                return
                            }
                            mutator.changeViewSwimlaneById(activeView.boardId, activeView.id, activeView.fields.swimlaneById, id)
                        }}
                    />
                ))}
            </Menu>
        </MenuWrapper>
    )
}

export default React.memo(ViewHeaderSubGroupByMenu)
