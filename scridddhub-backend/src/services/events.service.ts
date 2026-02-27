import { Db } from "mongodb";

export class EventsService {
    constructor(private db: Db) { }

    async publish(event: string, payload: any) {
        // Add to outbox
    }
}
