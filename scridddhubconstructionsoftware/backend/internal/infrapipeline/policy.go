package infrapipeline

import "fmt"

// PublishPolicy decides whether a stored project is shown to users immediately or waits for a
// person to review it (PIPELINE_PLAN.md decision 5). Set with INFRA_PUBLISH_POLICY.
type PublishPolicy string

const (
	// PolicyStrict: everything the pipeline produces waits for review.
	PolicyStrict PublishPolicy = "strict"
	// PolicyEvidence (default): approve only when no extracted field was rejected and every point
	// comes from an official geodata file; otherwise pending.
	PolicyEvidence PublishPolicy = "evidence"
	// PolicyAuto: approve anything whose name verified; rejected fields are simply left out.
	PolicyAuto PublishPolicy = "auto"
)

func ParsePublishPolicy(s string) (PublishPolicy, error) {
	switch PublishPolicy(s) {
	case "":
		return PolicyEvidence, nil
	case PolicyStrict, PolicyEvidence, PolicyAuto:
		return PublishPolicy(s), nil
	}
	return "", fmt.Errorf("unknown publish policy %q (want strict | evidence | auto)", s)
}

// Decide returns the review status for a project. A project whose name didn't verify must not be
// stored at all; Decide treats it as pending defensively.
func (p PublishPolicy) Decide(vp VerifiedProject, points []LocatedPoint) ReviewStatus {
	if _, ok := vp.FieldEvidence["name"]; !ok {
		return ReviewPending
	}
	switch p {
	case PolicyAuto:
		return ReviewApproved
	case PolicyEvidence:
		if len(vp.Rejected) > 0 || len(points) == 0 {
			return ReviewPending
		}
		for _, pt := range points {
			if pt.CoordSource != CoordOfficialFile {
				return ReviewPending
			}
		}
		return ReviewApproved
	default:
		return ReviewPending
	}
}
