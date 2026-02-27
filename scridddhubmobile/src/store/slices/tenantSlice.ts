import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface TenantState {
    industry: string | null;
    industryName: string | null;
    modules: string[];
}

const initialState: TenantState = {
    industry: null,
    industryName: null,
    modules: [],
};

const tenantSlice = createSlice({
    name: 'tenant',
    initialState,
    reducers: {
        setIndustry: (state, action: PayloadAction<{ id: string; name: string }>) => {
            state.industry = action.payload.id;
            state.industryName = action.payload.name;
        },
        resetTenant: (state) => {
            state.industry = null;
            state.industryName = null;
            state.modules = [];
        },
    },
});

export const { setIndustry, resetTenant } = tenantSlice.actions;
export default tenantSlice.reducer;
