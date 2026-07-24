// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package automation

import (
	"github.com/mattermost/focalboard/server/model"
	"github.com/mattermost/focalboard/server/services/notify"
)

// matchTrigger returns the card IDs a rule's trigger matches for the given event,
// or an empty slice if the rule doesn't match. Most triggers match a single card
// (the one that changed); dependency-unblocked can match several (every card that
// was waiting on the card that just became "done").
func matchTrigger(rule *model.AutomationRule, evt notify.BlockChangeEvent, store ruleStore) ([]string, error) {
	switch rule.TriggerType {
	case model.TriggerCardCreated:
		return matchCardCreated(evt), nil
	case model.TriggerPropertyChanged, model.TriggerMovedToGroup:
		return matchPropertyChanged(rule, evt), nil
	case model.TriggerChecklistCompleted:
		return matchChecklistCompleted(rule, evt, store), nil
	case model.TriggerDependencyUnblocked:
		return matchDependencyUnblocked(rule, evt, store)
	default:
		return nil, nil
	}
}

func matchCardCreated(evt notify.BlockChangeEvent) []string {
	if evt.Action == notify.Add && evt.BlockChanged.Type == model.TypeCard {
		return []string{evt.BlockChanged.ID}
	}
	return nil
}

// matchPropertyChanged covers both property-changed and moved-to-group: in this
// data model "group by" is just another select-type property, so there's no
// separate server-side concept for it - moved-to-group is property-changed with
// the property picked in the UI defaulting to a select/multiSelect property.
func matchPropertyChanged(rule *model.AutomationRule, evt notify.BlockChangeEvent) []string {
	if evt.Action != notify.Update || evt.BlockChanged.Type != model.TypeCard || evt.BlockOld == nil {
		return nil
	}

	propertyID, _ := rule.TriggerConfig["propertyId"].(string)
	if propertyID == "" {
		return nil
	}

	oldValue := propertyValue(evt.BlockOld, propertyID)
	newValue := propertyValue(evt.BlockChanged, propertyID)
	if oldValue == newValue {
		return nil
	}

	if toValue, ok := rule.TriggerConfig["toValue"]; ok {
		if newValue != toValue {
			return nil
		}
	}

	return []string{evt.BlockChanged.ID}
}

// matchChecklistCompleted fires when a checkbox content block changes and, as a
// result, every checkbox under its parent card is now checked. Scope note: only
// standalone checkbox blocks are counted (not markdown checkboxes embedded in
// text blocks) - replicating the webapp's checklistUtils.ts markdown-checkbox
// counting server-side in Go is out of scope for this rule engine.
func matchChecklistCompleted(rule *model.AutomationRule, evt notify.BlockChangeEvent, store ruleStore) []string {
	if evt.Action != notify.Update || evt.BlockChanged.Type != model.TypeCheckbox || evt.Card == nil {
		return nil
	}

	siblings, err := store.GetBlocksWithParentAndType(evt.Board.ID, evt.Card.ID, string(model.TypeCheckbox))
	if err != nil || len(siblings) == 0 {
		return nil
	}

	for _, sibling := range siblings {
		checked, _ := sibling.Fields["value"].(bool)
		if !checked {
			return nil
		}
	}

	return []string{evt.Card.ID}
}

// matchDependencyUnblocked fires when a card (the blocker) transitions into "done"
// (as defined by TriggerConfig's propertyId/doneValue) and, as a result, some other
// card that lists it in blockedBy now has ALL of its blockers done.
func matchDependencyUnblocked(rule *model.AutomationRule, evt notify.BlockChangeEvent, store ruleStore) ([]string, error) {
	if evt.Action != notify.Update || evt.BlockChanged.Type != model.TypeCard || evt.BlockOld == nil {
		return nil, nil
	}

	propertyID, _ := rule.TriggerConfig["propertyId"].(string)
	doneValue, hasDoneValue := rule.TriggerConfig["doneValue"]
	if propertyID == "" || !hasDoneValue {
		return nil, nil
	}

	oldValue := propertyValue(evt.BlockOld, propertyID)
	newValue := propertyValue(evt.BlockChanged, propertyID)
	if newValue != doneValue || oldValue == doneValue {
		// only fire on the transition into "done", not every subsequent no-op write
		return nil, nil
	}

	blockerID := evt.BlockChanged.ID
	cards, err := store.GetBlocksWithType(evt.Board.ID, string(model.TypeCard))
	if err != nil {
		return nil, err
	}

	matched := []string{}
	for _, card := range cards {
		if !blockedByIncludes(card, blockerID) {
			continue
		}
		if allBlockersDone(card, cards, propertyID, doneValue) {
			matched = append(matched, card.ID)
		}
	}
	return matched, nil
}

func propertyValue(block *model.Block, propertyID string) interface{} {
	properties, _ := block.Fields["properties"].(map[string]interface{})
	if properties == nil {
		return nil
	}
	return properties[propertyID]
}

func blockedByIncludes(card *model.Block, blockerID string) bool {
	rawList, _ := card.Fields["blockedBy"].([]interface{})
	for _, raw := range rawList {
		if id, ok := raw.(string); ok && id == blockerID {
			return true
		}
	}
	return false
}

func allBlockersDone(card *model.Block, allCards []*model.Block, propertyID string, doneValue interface{}) bool {
	rawList, _ := card.Fields["blockedBy"].([]interface{})
	if len(rawList) == 0 {
		return false
	}

	byID := make(map[string]*model.Block, len(allCards))
	for _, c := range allCards {
		byID[c.ID] = c
	}

	for _, raw := range rawList {
		blockerID, ok := raw.(string)
		if !ok {
			continue
		}
		blocker, found := byID[blockerID]
		if !found {
			continue // blocker no longer exists/visible - don't let a dead reference block completion
		}
		if propertyValue(blocker, propertyID) != doneValue {
			return false
		}
	}
	return true
}
