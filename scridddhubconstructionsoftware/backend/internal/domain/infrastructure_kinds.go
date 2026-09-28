package domain

// Infrastructure groups (migration 000033). Order is the display order in the app.
const (
	InfraConnectivity = "connectivity"
	InfraJobs         = "jobs"
	InfraSocial       = "social"
	InfraUtilities    = "utilities"
	InfraPlanning     = "planning"
	InfraNegative     = "negative"
)

// InfraKindCategory is the single source of truth for which kinds exist and which group each
// belongs to. It must match the CHECK constraint in migration 000036 (which extends 000033).
var InfraKindCategory = map[string]string{
	"metro": InfraConnectivity, "suburban_rail": InfraConnectivity, "high_speed_rail": InfraConnectivity,
	"highway": InfraConnectivity, "road": InfraConnectivity, "bridge": InfraConnectivity,
	"flyover": InfraConnectivity, "airport": InfraConnectivity, "bus_depot": InfraConnectivity,
	"jetty": InfraConnectivity, "rail_station": InfraConnectivity, "metro_station": InfraConnectivity,
	"expressway_exit": InfraConnectivity,

	"school": InfraSocial, "college": InfraSocial, "hospital": InfraSocial,
	"park": InfraSocial, "mall": InfraSocial,

	"it_park": InfraJobs, "sez": InfraJobs, "industrial_estate": InfraJobs, "logistics_park": InfraJobs,
	"data_centre": InfraJobs, "growth_centre": InfraJobs, "new_town": InfraJobs,

	"water_supply": InfraUtilities, "sewage_treatment": InfraUtilities, "power_substation": InfraUtilities,

	"dp_reservation": InfraPlanning, "tod_zone": InfraPlanning, "crz_zone": InfraPlanning,
	"eco_sensitive_zone": InfraPlanning, "mangrove": InfraPlanning, "forest": InfraPlanning,
	"protected_area": InfraPlanning,

	"landfill": InfraNegative, "high_tension_line": InfraNegative, "polluting_industry": InfraNegative,
	"flood_zone": InfraNegative, "cemetery": InfraNegative, "quarry": InfraNegative,

	"other": InfraConnectivity,
}

// CategoryForKind returns the group for a kind; unknown kinds are treated as "other".
func CategoryForKind(kind string) string {
	if c, ok := InfraKindCategory[kind]; ok {
		return c
	}
	return InfraConnectivity
}

// NormalizeKind returns kind if it's a known kind, else "other".
func NormalizeKind(kind string) string {
	if _, ok := InfraKindCategory[kind]; ok {
		return kind
	}
	return "other"
}
