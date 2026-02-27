import { create } from 'zustand';

// Temporary local store to persist added staff during this session
// This replaces the hardcoded mock data array.

export type StaffMember = {
    id: string;
    name: string;
    phone: string; // Used as Login ID
    role: 'yard_manager' | 'operator';
    status: 'Active' | 'Inactive';
    joinedAt: string;
};

type StaffStore = {
    staffMembers: StaffMember[];
    addStaff: (member: StaffMember) => void;
    removeStaff: (id: string) => void;
};

export const useStaffStore = create<StaffStore>((set) => ({
    staffMembers: [], // Start empty as requested (No fake data)
    addStaff: (member) => set((state) => ({
        staffMembers: [member, ...state.staffMembers]
    })),
    removeStaff: (id) => set((state) => ({
        staffMembers: state.staffMembers.filter((s) => s.id !== id)
    })),
}));
