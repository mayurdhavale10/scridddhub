import { IUserRepository } from "../lib/db/interfaces/user.repo";

export class AccessService {
    constructor(private userRepo: IUserRepository) { }

    async checkPermission(userId: string, permission: string) {
        const user = await this.userRepo.findById(userId);
        // Logic would go here...
        return !!user;
    }
}
