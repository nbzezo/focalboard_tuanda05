// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import {Card} from './blocks/card'

// wouldCreateCycle returns true if adding "cardId is blocked by candidateBlockerId"
// would create a dependency cycle - i.e. candidateBlockerId already (directly or
// transitively) depends on cardId via its own blockedBy chain. cardsById only
// needs to contain cards from the same board (dependencies are single-board).
export function wouldCreateCycle(cardsById: Record<string, Card>, cardId: string, candidateBlockerId: string): boolean {
    if (cardId === candidateBlockerId) {
        return true
    }

    const visited = new Set<string>()

    function dependsOn(currentId: string): boolean {
        if (currentId === cardId) {
            return true
        }
        if (visited.has(currentId)) {
            return false
        }
        visited.add(currentId)

        const blockers = cardsById[currentId]?.fields.blockedBy || []
        return blockers.some((blockerId) => dependsOn(blockerId))
    }

    return dependsOn(candidateBlockerId)
}
