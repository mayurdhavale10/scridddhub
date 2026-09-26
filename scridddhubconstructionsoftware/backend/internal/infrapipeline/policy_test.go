package infrapipeline

import "testing"

func TestPublishPolicy(t *testing.T) {
	verified := VerifiedProject{FieldEvidence: map[string]string{"name": "Metro Line 5 ..."}}
	withReject := VerifiedProject{FieldEvidence: map[string]string{"name": "x"}, Rejected: []string{"expected_completion"}}
	noName := VerifiedProject{FieldEvidence: map[string]string{}, Rejected: []string{"name"}}
	official := []LocatedPoint{{CoordSource: CoordOfficialFile}}
	approx := []LocatedPoint{{CoordSource: CoordOfficialFile}, {CoordSource: CoordApproximate}}

	cases := []struct {
		policy PublishPolicy
		vp     VerifiedProject
		pts    []LocatedPoint
		want   ReviewStatus
	}{
		{PolicyEvidence, verified, official, ReviewApproved},
		{PolicyEvidence, verified, approx, ReviewPending},     // any geocoded point → review
		{PolicyEvidence, verified, nil, ReviewPending},        // unlocated → review
		{PolicyEvidence, withReject, official, ReviewPending}, // model claimed something unsupported → review
		{PolicyStrict, verified, official, ReviewPending},
		{PolicyAuto, withReject, nil, ReviewApproved},
		{PolicyAuto, noName, official, ReviewPending},
	}
	for i, c := range cases {
		if got := c.policy.Decide(c.vp, c.pts); got != c.want {
			t.Errorf("case %d (%s): got %s, want %s", i, c.policy, got, c.want)
		}
	}
	if p, err := ParsePublishPolicy(""); err != nil || p != PolicyEvidence {
		t.Error("empty policy must default to evidence")
	}
	if _, err := ParsePublishPolicy("yolo"); err == nil {
		t.Error("unknown policy must error")
	}
}
