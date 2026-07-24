// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import {Card} from './blocks/card'
import {IPropertyTemplate, IPropertyOption, BoardGroup} from './blocks/board'

export type Swimlane = {
    option: IPropertyOption
    cards: Card[]
    groups: BoardGroup[]
}

// groupCardsTwoLevels groups cards first by swimlaneByProperty (the outer axis,
// one row per option, always including the "no value" option) and then, within
// each swimlane, by groupByProperty (the normal kanban column axis) using the
// same visible/hidden column rules as the single-level board view.
export function groupCardsTwoLevels(cards: Card[], visibleOptionIds: string[], hiddenOptionIds: string[], groupByProperty: IPropertyTemplate|undefined, swimlaneByProperty: IPropertyTemplate): Swimlane[] {
    const allSwimlaneOptionIds = swimlaneByProperty.options.map((o) => o.id)
    if (!allSwimlaneOptionIds.includes('')) {
        allSwimlaneOptionIds.unshift('')
    }

    const outerGroups = groupCardsByOptions(cards, allSwimlaneOptionIds, swimlaneByProperty)
    return outerGroups.map((outerGroup): Swimlane => {
        const {visible: innerGroups} = getVisibleAndHiddenGroups(outerGroup.cards, visibleOptionIds, hiddenOptionIds, groupByProperty)
        return {
            option: outerGroup.option,
            cards: outerGroup.cards,
            groups: innerGroups,
        }
    })
}

export function groupCardsByOptions(cards: Card[], optionIds: string[], groupByProperty?: IPropertyTemplate): BoardGroup[] {
    const groups = []
    for (const optionId of optionIds) {
        if (optionId) {
            const option = groupByProperty?.options.find((o) => o.id === optionId)
            if (option) {
                const c = cards.filter((o) => optionId === o.fields?.properties[groupByProperty!.id])
                const group: BoardGroup = {
                    option,
                    cards: c,
                }
                groups.push(group)
            } else {
                // if optionId not found, its an old (deleted) option that can be ignored
            }
        } else {
            // Empty group
            const emptyGroupCards = cards.filter((card) => {
                const groupByOptionId = card.fields.properties[groupByProperty?.id || '']
                return !groupByOptionId || !groupByProperty?.options.find((option) => option.id === groupByOptionId)
            })
            const group: BoardGroup = {
                option: {id: '', value: `No ${groupByProperty?.name}`, color: ''},
                cards: emptyGroupCards,
            }
            groups.push(group)
        }
    }
    return groups
}

function getOptionGroups(cards: Card[], visibleOptionIds: string[], hiddenOptionIds: string[], groupByProperty?: IPropertyTemplate): {visible: BoardGroup[], hidden: BoardGroup[]} {
    let unassignedOptionIds: string[] = []
    if (groupByProperty) {
        unassignedOptionIds = groupByProperty.options.
            filter((o: IPropertyOption) => !visibleOptionIds.includes(o.id) && !hiddenOptionIds.includes(o.id)).
            map((o: IPropertyOption) => o.id)
    }
    const allVisibleOptionIds = [...visibleOptionIds, ...unassignedOptionIds]

    // If the empty group positon is not explicitly specified, make it the first visible column
    if (!allVisibleOptionIds.includes('') && !hiddenOptionIds.includes('')) {
        allVisibleOptionIds.unshift('')
    }

    const visibleGroups = groupCardsByOptions(cards, allVisibleOptionIds, groupByProperty)
    const hiddenGroups = groupCardsByOptions(cards, hiddenOptionIds, groupByProperty)
    return {visible: visibleGroups, hidden: hiddenGroups}
}
export function getVisibleAndHiddenGroups(cards: Card[], visibleOptionIds: string[], hiddenOptionIds: string[], groupByProperty?: IPropertyTemplate): {visible: BoardGroup[], hidden: BoardGroup[]} {
    if (groupByProperty?.type === 'createdBy' || groupByProperty?.type === 'updatedBy' || groupByProperty?.type === 'person') {
        return getPersonGroups(cards, groupByProperty, hiddenOptionIds)
    }

    return getOptionGroups(cards, visibleOptionIds, hiddenOptionIds, groupByProperty)
}

function getPersonGroups(cards: Card[], groupByProperty: IPropertyTemplate, hiddenOptionIds: string[]): {visible: BoardGroup[], hidden: BoardGroup[]} {
    const groups = cards.reduce((unique: {[key: string]: Card[]}, item: Card): {[key: string]: Card[]} => {
        let key = item.fields.properties[groupByProperty.id] as string
        if (groupByProperty?.type === 'createdBy') {
            key = item.createdBy
        } else if (groupByProperty?.type === 'updatedBy') {
            key = item.modifiedBy
        }

        const curGroup = unique[key] ?? []
        return {...unique, [key]: [...curGroup, item]}
    }, {})

    const hiddenGroups: BoardGroup[] = []
    const visibleGroups: BoardGroup[] = []
    Object.entries(groups).forEach(([key, value]) => {
        const propertyOption = {id: key, value: key, color: ''} as IPropertyOption
        if (hiddenOptionIds.find((e) => e === key)) {
            hiddenGroups.push({option: propertyOption, cards: value})
        } else {
            visibleGroups.push({option: propertyOption, cards: value})
        }
    })

    return {visible: visibleGroups, hidden: hiddenGroups}
}
