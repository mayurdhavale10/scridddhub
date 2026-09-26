package middleware

import (
	"context"
	"net/http"
)

type contextKey string

const actorContextKey contextKey = "actor"

// devActor is the hardcoded actor used until real auth (RBAC: Developer/CA/Engineer/Architect)
// is implemented as its own vertical slice.
const devActor = "dev-user"

// StubAuth attaches a fixed actor to every request so downstream code (usecases, repositories)
// can already depend on ActorFromContext rather than a real auth system landing later.
func StubAuth(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ctx := context.WithValue(r.Context(), actorContextKey, devActor)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

func ActorFromContext(ctx context.Context) string {
	actor, ok := ctx.Value(actorContextKey).(string)
	if !ok || actor == "" {
		return devActor
	}
	return actor
}
