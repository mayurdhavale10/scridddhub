import { User } from "../../../models/access/user.model";

export interface IUserRepository {
    create(user: Omit<User, "_id" | "createdAt" | "updatedAt">): Promise<User>;
    findById(id: string): Promise<User | null>;
    findByEmail(email: string): Promise<User | null>;
    update(id: string, updates: Partial<User>): Promise<User | null>;
    delete(id: string): Promise<boolean>;
}
