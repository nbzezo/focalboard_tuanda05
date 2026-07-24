// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Package automation implements the "when X happens on this board, do Y" rules
// engine as a notify.Backend: every block mutation already fans out to
// notify.Backend.BlockChanged via app.blocks.go's blockChangeNotifier (see
// notify/service.go), so this package plugs into that existing hook rather
// than adding a new one.
package automation

import (
	"sync"
	"time"

	"github.com/mattermost/focalboard/server/model"
	"github.com/mattermost/focalboard/server/services/notify"
	"github.com/wiggin77/merror"

	"github.com/mattermost/mattermost/server/public/shared/mlog"
)

const (
	backendName  = "automation"
	ruleCacheTTL = 30 * time.Second
)

type ruleCacheEntry struct {
	rules   []*model.AutomationRule
	expires time.Time
}

// Backend is the notify.Backend implementation that evaluates automation rules
// against every block change and executes matching rules' actions.
//
// v1 limitation (documented, not a bug): rule caching is per-board with a 30s
// TTL and no cross-node invalidation - on a multi-node deployment a rule
// edited on one node can take up to 30s to apply on the others. InvalidateCache
// is called locally by the API handlers on this same node for the common case.
type Backend struct {
	store       ruleStore
	logger      mlog.LoggerIFace
	rateLimiter *rateLimiter

	cacheMux sync.RWMutex
	cache    map[string]ruleCacheEntry // key: boardID

	executorMux sync.RWMutex
	executor    ActionExecutor
}

func New(store ruleStore, logger mlog.LoggerIFace) *Backend {
	return &Backend{
		store:       store,
		logger:      logger,
		rateLimiter: newRateLimiter(),
		cache:       map[string]ruleCacheEntry{},
	}
}

// SetActionExecutor injects the *app.App reference needed to execute actions.
// It's called once, immediately after app.New() returns (see server/server.go) -
// see the ActionExecutor doc comment in store_api.go for why this can't just be
// a constructor parameter.
func (b *Backend) SetActionExecutor(executor ActionExecutor) {
	b.executorMux.Lock()
	defer b.executorMux.Unlock()
	b.executor = executor
}

func (b *Backend) getExecutor() ActionExecutor {
	b.executorMux.RLock()
	defer b.executorMux.RUnlock()
	return b.executor
}

func (b *Backend) Start() error {
	return nil
}

func (b *Backend) ShutDown() error {
	return nil
}

func (b *Backend) Name() string {
	return backendName
}

func (b *Backend) BlockChanged(evt notify.BlockChangeEvent) error {
	if evt.Board == nil || evt.BlockChanged == nil {
		return nil
	}
	// Defense-in-depth: automation's own writes already skip notify entirely via
	// disableNotify=true (see actions.go), so this event should never actually
	// carry BotUserID - but checking costs nothing and protects against that
	// invariant ever being accidentally violated by a future code change.
	if evt.ModifiedBy != nil && evt.ModifiedBy.UserID == BotUserID {
		return nil
	}

	rules, err := b.rulesForBoard(evt.Board.ID)
	if err != nil {
		return err
	}

	merr := merror.New()
	for _, rule := range rules {
		if !rule.Enabled {
			continue
		}
		cardIDs, err := matchTrigger(rule, evt, b.store)
		if err != nil {
			merr.Append(err)
			continue
		}
		for _, cardID := range cardIDs {
			b.fire(rule, cardID)
		}
	}
	return merr.ErrorOrNil()
}

func (b *Backend) fire(rule *model.AutomationRule, cardID string) {
	if !b.rateLimiter.Allow(rule.ID, cardID) {
		b.logRun(rule.ID, cardID, model.RunStatusSkipped, "rate limited")
		return
	}

	if err := b.executeActions(rule, cardID); err != nil {
		b.logger.Error("Automation rule action failed",
			mlog.String("rule_id", rule.ID),
			mlog.String("card_id", cardID),
			mlog.Err(err),
		)
		b.logRun(rule.ID, cardID, model.RunStatusError, err.Error())
		return
	}
	b.logRun(rule.ID, cardID, model.RunStatusSuccess, "")
}

func (b *Backend) logRun(ruleID, cardID string, status model.AutomationRunStatus, errMsg string) {
	run := &model.AutomationRun{
		RuleID: ruleID,
		CardID: cardID,
		Status: status,
		Error:  errMsg,
	}
	if _, err := b.store.CreateAutomationRun(run); err != nil {
		b.logger.Error("Cannot record automation run", mlog.String("rule_id", ruleID), mlog.Err(err))
	}
}

func (b *Backend) rulesForBoard(boardID string) ([]*model.AutomationRule, error) {
	b.cacheMux.RLock()
	entry, ok := b.cache[boardID]
	b.cacheMux.RUnlock()
	if ok && time.Now().Before(entry.expires) {
		return entry.rules, nil
	}

	rules, err := b.store.GetAutomationRules(boardID)
	if err != nil {
		return nil, err
	}

	b.cacheMux.Lock()
	b.cache[boardID] = ruleCacheEntry{rules: rules, expires: time.Now().Add(ruleCacheTTL)}
	b.cacheMux.Unlock()

	return rules, nil
}

// InvalidateCache drops the cached rule list for a board, so a rule CRUD change
// (via the REST API, see api/automation.go) takes effect immediately on this
// node instead of waiting out the TTL.
func (b *Backend) InvalidateCache(boardID string) {
	b.cacheMux.Lock()
	delete(b.cache, boardID)
	b.cacheMux.Unlock()
}
