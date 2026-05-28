import { MongoClient } from 'mongodb';
import { randomBytes } from 'crypto';
import { encryptPat, decryptPat, hashPassword, verifyPassword } from './secrets.js';

let client;
let db;

export async function getDb() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('[DB] MONGODB_URI is not set');
    return null;
  }

  if (!client) {
    try {
      client = new MongoClient(uri, {
        maxPoolSize: 1,
        minPoolSize: 0,
        maxIdleTimeMS: 10000,
        serverSelectionTimeoutMS: 5000,
      });
      await client.connect();
      db = client.db();
      await db.collection('rate_limits').createIndex(
        { windowStart: 1 },
        { expireAfterSeconds: 86400 }
      );
    } catch (err) {
      console.error('[DB] Connection failed:', err.message);
      client = null;
      db = null;
      return null;
    }
  }
  return db;
}

export async function saveCustomerModel({ slug, orgName, orgId, model, password, pat }) {
  const database = await getDb();
  if (!database) {
    throw new Error('Database connection unavailable. Check MONGODB_URI env var.');
  }

  const now = new Date();
  const setFields = { orgName, orgId, model, lastRefreshed: now };
  const setOnInsert = { discoveredAt: now, snapshots: [] };

  if (password) {
    setFields.passwordHash = await hashPassword(password);
  }
  if (pat) {
    setFields.encryptedPat = encryptPat(pat);
  }

  await database.collection('customers').updateOne(
    { slug },
    {
      $set: setFields,
      $setOnInsert: setOnInsert,
    },
    { upsert: true }
  );

  return { slug, orgName, orgId };
}

export async function getCustomerBySlug(slug) {
  const database = await getDb();
  if (!database) return null;
  return database.collection('customers').findOne(
    { slug },
    {
      projection: {
        passwordHash: 0,
        encryptedPat: 0,
      },
    }
  );
}

export async function customerHasStoredPat(slug) {
  const database = await getDb();
  if (!database) return false;
  const doc = await database.collection('customers').findOne(
    { slug },
    { projection: { encryptedPat: 1 } }
  );
  return !!doc?.encryptedPat;
}

export async function listCustomers() {
  const database = await getDb();
  if (!database) {
    console.error('[DB] listCustomers: no database connection');
    return [];
  }
  return database.collection('customers')
    .find({}, { projection: { slug: 1, orgName: 1, orgId: 1, discoveredAt: 1, lastRefreshed: 1, lastViewedAt: 1, viewCount: 1, _id: 0 } })
    .sort({ lastRefreshed: -1 })
    .toArray();
}

export async function getCustomerPat(slug) {
  const database = await getDb();
  if (!database) return null;
  const doc = await database.collection('customers').findOne({ slug }, { projection: { encryptedPat: 1 } });
  if (!doc?.encryptedPat) return null;
  return decryptPat(doc.encryptedPat);
}

export async function verifyOrgPassword(slug, password) {
  const database = await getDb();
  if (!database) return false;
  const doc = await database.collection('customers').findOne({ slug }, { projection: { passwordHash: 1 } });
  if (!doc?.passwordHash) return false;
  return verifyPassword(password, doc.passwordHash);
}

export async function recordCustomerView(slug) {
  const database = await getDb();
  if (!database) return;
  await database.collection('customers').updateOne(
    { slug },
    { $set: { lastViewedAt: new Date() }, $inc: { viewCount: 1 } }
  );
}

export async function deleteCustomerOrg(slug) {
  const database = await getDb();
  if (!database) {
    throw new Error('Database connection unavailable.');
  }

  await database.collection('customers').deleteOne({ slug });
  await database.collection('share_tokens').deleteMany({ slug });
  await database.collection('annotations').deleteMany({ slug });

  return { deleted: slug };
}

export async function saveSnapshot(slug, model) {
  const database = await getDb();
  if (!database) return;

  const now = new Date();
  await database.collection('customers').updateOne(
    { slug },
    {
      $push: {
        snapshots: {
          $each: [{ model, createdAt: now }],
          $slice: -3,
        },
      },
    }
  );
}

export async function getSnapshots(slug) {
  const database = await getDb();
  if (!database) return [];
  const doc = await database.collection('customers').findOne({ slug }, { projection: { snapshots: 1 } });
  return doc?.snapshots || [];
}

export async function createShareToken(slug, expiresInHours, createdBy) {
  const database = await getDb();
  if (!database) return null;

  const token = randomBytes(24).toString('hex');
  const expiresAt = new Date(Date.now() + expiresInHours * 60 * 60 * 1000);

  await database.collection('share_tokens').insertOne({
    token,
    slug,
    expiresAt,
    createdBy,
    createdAt: new Date(),
  });

  return { token, expiresAt };
}

export async function verifyShareToken(token) {
  const database = await getDb();
  if (!database) return null;

  const doc = await database.collection('share_tokens').findOne({ token });
  if (!doc) return null;
  if (new Date() > doc.expiresAt) return null;
  return doc.slug;
}

export async function listShareTokens(slug) {
  const database = await getDb();
  if (!database) return [];
  return database.collection('share_tokens')
    .find({ slug, expiresAt: { $gt: new Date() } })
    .sort({ createdAt: -1 })
    .toArray();
}

export async function deleteShareToken(token, slug) {
  const database = await getDb();
  if (!database) return false;
  const result = await database.collection('share_tokens').deleteOne({ token, slug });
  return result.deletedCount === 1;
}

export async function addAnnotation(slug, { nodeType, edgeKey, text, author, annotationType }) {
  const database = await getDb();
  if (!database) return null;

  const annotation = {
    id: randomBytes(8).toString('hex'),
    slug,
    nodeType: nodeType || null,
    edgeKey: edgeKey || null,
    annotationType: annotationType || 'context',
    text,
    author,
    createdAt: new Date(),
  };

  await database.collection('annotations').insertOne(annotation);
  return annotation;
}

export async function getAnnotations(slug) {
  const database = await getDb();
  if (!database) return [];
  return database.collection('annotations')
    .find({ slug })
    .sort({ createdAt: -1 })
    .toArray();
}

export async function deleteAnnotation(id, slug) {
  const database = await getDb();
  if (!database) return false;
  const result = await database.collection('annotations').deleteOne({ id, slug });
  return result.deletedCount === 1;
}
