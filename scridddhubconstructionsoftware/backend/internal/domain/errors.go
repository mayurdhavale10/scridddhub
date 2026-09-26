package domain

import "errors"

var (
	ErrNotFound     = errors.New("not found")
	ErrInvalidStage = errors.New("invalid stage")
)
