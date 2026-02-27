import { Db } from 'mongodb';

export const itemsCollection = (db: Db) => db.collection('inventory_items');
