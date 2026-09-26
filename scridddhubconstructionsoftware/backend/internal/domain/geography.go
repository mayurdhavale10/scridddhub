package domain

// VillageMatch is one hit from a free-text village search — carries the full district/taluka/
// village triple a match resolves to, since that's what EstimateParcelValueUsecase needs (see
// docs/adr/0006). Lets the mobile app offer a single search field instead of three cascading
// district → taluka → village pickers.
type VillageMatch struct {
	District string
	Taluka   string
	Village  string
}
