// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package automation

import (
	"errors"
	"fmt"
	"strings"

	"github.com/mattermost/focalboard/server/model"
	"github.com/mattermost/focalboard/server/utils"
	"github.com/wiggin77/merror"

	"github.com/mattermost/mattermost/server/public/shared/mlog"
)

// BotUserID tags every mutation the automation engine performs, so it's
// distinguishable from real user activity in blocks_history/audit logs. It is
// deliberately NOT model.SystemUserID (which suppresses ALL notify backends
// unconditionally) - automation's loop guard is disableNotify=true on the
// specific writes it makes (see executeSetProperty/executeAddComment below),
// not a blanket suppression, so other backends (e.g. subscriptions, in plugin
// mode) still see and react to automation-driven changes normally.
const BotUserID = "automation-bot"

var errActionExecutorNotReady = errors.New("automation: action executor not yet initialized")

func (b *Backend) executeActions(rule *model.AutomationRule, cardID string) error {
	card, err := b.store.GetBlock(cardID)
	if err != nil {
		return fmt.Errorf("cannot load card %s for rule %s: %w", cardID, rule.ID, err)
	}

	executor := b.getExecutor()
	if executor == nil {
		return errActionExecutorNotReady
	}

	merr := merror.New()
	for _, action := range rule.Actions {
		if err := b.executeAction(executor, card, action); err != nil {
			merr.Append(fmt.Errorf("action %s failed: %w", action.Type, err))
		}
	}
	return merr.ErrorOrNil()
}

func (b *Backend) executeAction(executor ActionExecutor, card *model.Block, action model.AutomationAction) error {
	switch action.Type {
	case model.ActionSetProperty, model.ActionMoveToGroup:
		return executeSetProperty(executor, card, action)
	case model.ActionAddComment:
		return executeAddComment(executor, card, action)
	case model.ActionNotifyUser:
		return b.executeNotifyUser(card, action)
	default:
		return fmt.Errorf("unknown action type %q", action.Type)
	}
}

// executeSetProperty clones the card's existing properties map and overwrites just
// the configured propertyId - BlockPatch.UpdatedFields does a shallow merge at the
// top level of Fields, so passing a partial "properties" map would clobber every
// other property on the card instead of merging one key into it.
func executeSetProperty(executor ActionExecutor, card *model.Block, action model.AutomationAction) error {
	propertyID, _ := action.Config["propertyId"].(string)
	if propertyID == "" {
		return errors.New("missing propertyId in action config")
	}
	value := action.Config["value"]

	existing, _ := card.Fields["properties"].(map[string]interface{})
	updated := make(map[string]interface{}, len(existing)+1)
	for k, v := range existing {
		updated[k] = v
	}
	updated[propertyID] = value

	patch := &model.BlockPatch{UpdatedFields: map[string]interface{}{"properties": updated}}
	_, err := executor.PatchBlockAndNotify(card.ID, patch, BotUserID, true)
	return err
}

func executeAddComment(executor ActionExecutor, card *model.Block, action model.AutomationAction) error {
	message, _ := action.Config["message"].(string)
	if message == "" {
		return errors.New("missing message in action config")
	}
	message = strings.ReplaceAll(message, "{{card.title}}", card.Title)

	comment := &model.Block{
		ID:       utils.NewID(utils.IDTypeBlock),
		ParentID: card.ID,
		BoardID:  card.BoardID,
		Type:     model.TypeComment,
		Title:    message,
		Fields:   map[string]interface{}{},
	}
	return executor.InsertBlockAndNotify(comment, BotUserID, true)
}

// executeNotifyUser subscribes the target user to the card. Delivery is only
// wired end-to-end in plugin mode: subscribing makes the card show up as
// "followed" in both run modes, and in plugin mode the existing
// notifysubscriptions backend's own polling/delivery loop (already running
// there for ordinary card follows) picks up the subscription and sends a real
// notification. In standalone mode there is no notification delivery channel
// at all (same limitation notifysubscriptions/notifymentions already have -
// see NotifyBackends: nil in linux/main.go), so this is a documented no-op
// beyond the subscribe side effect; the configured message is still logged
// for operator visibility.
func (b *Backend) executeNotifyUser(card *model.Block, action model.AutomationAction) error {
	userID, _ := action.Config["userId"].(string)
	if userID == "" {
		return errors.New("missing userId in action config")
	}
	message, _ := action.Config["message"].(string)
	message = strings.ReplaceAll(message, "{{card.title}}", card.Title)

	sub := &model.Subscription{
		BlockType:      model.TypeCard,
		BlockID:        card.ID,
		SubscriberType: model.SubTypeUser,
		SubscriberID:   userID,
	}
	if _, err := b.store.CreateSubscription(sub); err != nil {
		return fmt.Errorf("cannot subscribe user %s to card %s: %w", userID, card.ID, err)
	}

	b.logger.Info("Automation notify-user action",
		mlog.String("user_id", userID),
		mlog.String("card_id", card.ID),
		mlog.String("message", message),
	)
	return nil
}
