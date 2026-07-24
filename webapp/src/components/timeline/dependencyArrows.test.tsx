// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import {render} from '@testing-library/react'
import '@testing-library/jest-dom'

import {wrapIntl} from '../../testUtils'

import DependencyArrows from './dependencyArrows'

describe('components/timeline/dependencyArrows', () => {
    const viewStart = Date.UTC(2024, 0, 1)

    test('draws one line per blocker -> blocked pair', () => {
        const rangeByCardId = {
            blocker: {from: Date.UTC(2024, 0, 5), to: Date.UTC(2024, 0, 10)},
            blocked: {from: Date.UTC(2024, 0, 15), to: Date.UTC(2024, 0, 20)},
        }
        const rowIndexByCardId = {blocker: 0, blocked: 1}
        const dependencyMap = {blocker: ['blocked']}

        const {container} = render(wrapIntl(
            <DependencyArrows
                rangeByCardId={rangeByCardId}
                rowIndexByCardId={rowIndexByCardId}
                dependencyMap={dependencyMap}
                viewStart={viewStart}
                zoom='day'
                totalWidth={2000}
                totalHeight={200}
            />,
        ))

        const lines = container.querySelectorAll('line')
        expect(lines).toHaveLength(1)
        expect(lines[0]).toHaveClass('DependencyArrows__line')
        expect(lines[0]).not.toHaveClass('DependencyArrows__line--violated')
    })

    test('marks the line as violated when the blocked card starts before its blocker ends', () => {
        const rangeByCardId = {
            blocker: {from: Date.UTC(2024, 0, 5), to: Date.UTC(2024, 0, 20)},
            blocked: {from: Date.UTC(2024, 0, 10), to: Date.UTC(2024, 0, 25)},
        }
        const rowIndexByCardId = {blocker: 0, blocked: 1}
        const dependencyMap = {blocker: ['blocked']}

        const {container} = render(wrapIntl(
            <DependencyArrows
                rangeByCardId={rangeByCardId}
                rowIndexByCardId={rowIndexByCardId}
                dependencyMap={dependencyMap}
                viewStart={viewStart}
                zoom='day'
                totalWidth={2000}
                totalHeight={200}
            />,
        ))

        expect(container.querySelector('line')).toHaveClass('DependencyArrows__line--violated')
    })

    test('skips pairs where either card has no resolved range (e.g. unscheduled)', () => {
        const rangeByCardId = {
            blocker: {from: Date.UTC(2024, 0, 5), to: Date.UTC(2024, 0, 10)},
        }
        const rowIndexByCardId = {blocker: 0}
        const dependencyMap = {blocker: ['unscheduled-blocked-card']}

        const {container} = render(wrapIntl(
            <DependencyArrows
                rangeByCardId={rangeByCardId}
                rowIndexByCardId={rowIndexByCardId}
                dependencyMap={dependencyMap}
                viewStart={viewStart}
                zoom='day'
                totalWidth={2000}
                totalHeight={200}
            />,
        ))

        expect(container.querySelectorAll('line')).toHaveLength(0)
    })
})
