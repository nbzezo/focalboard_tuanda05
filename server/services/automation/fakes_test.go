// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package automation

import (
	"github.com/mattermost/focalboard/server/model"
)

// fakeStore is a minimal hand-rolled double for ruleStore - the interface is
// small enough that a fake is simpler than wiring up gomock/mockstore (whose
// full store.Store surface is much larger than what this package needs).
type fakeStore struct {
	rules            map[string][]*model.AutomationRule // boardID -> rules
	blocksByParent    map[string][]*model.Block          // parentID -> children
	blocksByType      map[string][]*model.Block          // boardID -> cards
	blocksByID        map[string]*model.Block
	runs              []*model.AutomationRun
	subscriptions     []*model.Subscription
	getRulesCallCount int
}

func newFakeStore() *fakeStore {
	return &fakeStore{
		rules:          map[string][]*model.AutomationRule{},
		blocksByParent: map[string][]*model.Block{},
		blocksByType:   map[string][]*model.Block{},
		blocksByID:     map[string]*model.Block{},
	}
}

func (f *fakeStore) GetAutomationRules(boardID string) ([]*model.AutomationRule, error) {
	f.getRulesCallCount++
	return f.rules[boardID], nil
}

func (f *fakeStore) CreateAutomationRun(run *model.AutomationRun) (*model.AutomationRun, error) {
	f.runs = append(f.runs, run)
	return run, nil
}

func (f *fakeStore) GetBlocksWithParentAndType(_, parentID, blockType string) ([]*model.Block, error) {
	result := []*model.Block{}
	for _, b := range f.blocksByParent[parentID] {
		if string(b.Type) == blockType {
			result = append(result, b)
		}
	}
	return result, nil
}

func (f *fakeStore) GetBlocksWithType(boardID, blockType string) ([]*model.Block, error) {
	result := []*model.Block{}
	for _, b := range f.blocksByType[boardID] {
		if string(b.Type) == blockType {
			result = append(result, b)
		}
	}
	return result, nil
}

func (f *fakeStore) GetBlock(blockID string) (*model.Block, error) {
	b, ok := f.blocksByID[blockID]
	if !ok {
		return nil, model.NewErrNotFound("block ID=" + blockID)
	}
	return b, nil
}

func (f *fakeStore) CreateSubscription(sub *model.Subscription) (*model.Subscription, error) {
	f.subscriptions = append(f.subscriptions, sub)
	return sub, nil
}

// fakeExecutor is a minimal hand-rolled double for ActionExecutor.
type fakeExecutor struct {
	patches       []patchCall
	insertedBlock []*model.Block
	patchErr      error
	insertErr     error
}

type patchCall struct {
	blockID      string
	patch        *model.BlockPatch
	modifiedByID string
	disableNotify bool
}

func (f *fakeExecutor) PatchBlockAndNotify(blockID string, blockPatch *model.BlockPatch, modifiedByID string, disableNotify bool) (*model.Block, error) {
	f.patches = append(f.patches, patchCall{blockID, blockPatch, modifiedByID, disableNotify})
	if f.patchErr != nil {
		return nil, f.patchErr
	}
	return &model.Block{ID: blockID}, nil
}

func (f *fakeExecutor) InsertBlockAndNotify(block *model.Block, modifiedByID string, disableNotify bool) error {
	block.ModifiedBy = modifiedByID
	f.insertedBlock = append(f.insertedBlock, block)
	return f.insertErr
}
