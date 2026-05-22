import { MongoClient } from 'mongodb';

let client;
let db;

export async function getDb() {
  const uri = process.env.MONGODB_URI;
  if (!uri) return null;

  if (!client) {
    client = new MongoClient(uri);
    await client.connect();
    db = client.db();
  }
  return db;
}

export async function saveCustomerModel({ slug, orgName, orgId, model }) {
  const database = await getDb();
  if (!database) return null;

  const now = new Date();
  const doc = {
    slug,
    orgName,
    orgId,
    model,
    discoveredAt: now,
    lastRefreshed: now,
  };

  await database.collection('customers').updateOne(
    { slug },
    {
      $set: { orgName, orgId, model, lastRefreshed: now },
      $setOnInsert: { discoveredAt: now },
    },
    { upsert: true }
  );

  return doc;
}

export async function getCustomerBySlug(slug) {
  const database = await getDb();
  if (!database) return null;
  return database.collection('customers').findOne({ slug });
}
