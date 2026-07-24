// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package automation

import (
	"sync"
	"time"
)

const (
	rateLimitWindow = time.Minute
	rateLimitMax    = 10
)

// rateLimiter caps how many times a given rule may fire for a given card within a
// rolling time window. This is defense-in-depth, not the primary loop guard - the
// primary guard is that automation-initiated writes go through
// PatchBlockAndNotify/InsertBlockAndNotify with disableNotify=true, so they never
// generate a new BlockChangeEvent that could retrigger any rule (including this
// one) in the first place. The rate limiter instead protects against a single
// legitimate rule being hit unexpectedly often (e.g. a busy card being edited
// rapidly by a person, or a fan-out where several other cards' independent
// changes all happen to match the same rule for the same card in quick succession).
type rateLimiter struct {
	mux  sync.Mutex
	hits map[string][]time.Time // key: ruleID + "/" + cardID
}

func newRateLimiter() *rateLimiter {
	return &rateLimiter{hits: map[string][]time.Time{}}
}

// Allow reports whether another firing of ruleID against cardID is permitted right
// now, and records this call as one of the hits counted toward the window if so.
func (r *rateLimiter) Allow(ruleID, cardID string) bool {
	key := ruleID + "/" + cardID
	now := time.Now()

	r.mux.Lock()
	defer r.mux.Unlock()

	kept := r.hits[key][:0]
	for _, t := range r.hits[key] {
		if now.Sub(t) < rateLimitWindow {
			kept = append(kept, t)
		}
	}

	if len(kept) >= rateLimitMax {
		r.hits[key] = kept
		return false
	}

	kept = append(kept, now)
	r.hits[key] = kept
	return true
}
