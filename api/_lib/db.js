import { MongoClient } from 'mongodb';
import { createHash, randomBytes, timingSafeEqual } from 'crypto';

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
      client = new MongoClient(uri);
      await client.connect();
      db = client.db();
    } catch (err) {
      console.error('[DB] Connection failed:', err.message);
      client = null;
      db = null;
      return null;
    }
  }
  return db;
}

// ------------------------------------------------------------------
// Password hashing (simple sha256 + salt for serverless perf)
// ------------------------------------------------------------------

export function hashPassword(plaintext) {
  const salt = randomBytes(16).toString('hex');
  const hash = createHash('sha256').update(salt + plaintext).digest('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(plaintext, stored) {
  const [salt, hash] = stored.split(':');
  const attempt = createHash('sha256').update(salt + plaintext).digest('hex');
  return timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(attempt, 'hex'));
}

// ------------------------------------------------------------------
// PAT encryption (AES-like using XOR with env key - lightweight)
// For production, use a proper KMS. This keeps PATs not plaintext in DB.
// ------------------------------------------------------------------

function getEncryptionKey() {
  const key = process.env.PAT_ENCRYPTION_KEY || process.env.JWT_SECRET || '';
  return createHash('sha256').update(key).digest();
}

export function encryptPat(pat) {
  const key = getEncryptionKey();
  const iv = randomBytes(16);
  const buf = Buffer.from(pat, 'utf8');
  const encrypted = Buffer.alloc(buf.length);
  for (let i = 0; i < buf.length; i++) {
    encrypted[i] = buf[i] ^ key[(i + iv[i % 16]) % 32];
  }
  return iv.toString('hex') + ':' + encrypted.toString('hex');
}

export function decryptPat(stored) {
  const key = getEncryptionKey();
  const [ivHex, encHex] = stored.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const encrypted = Buffer.from(encHex, 'hex');
  const decrypted = Buffer.alloc(encrypted.length);
  for (let i = 0; i < encrypted.length; i++) {
    decrypted[i] = encrypted[i] ^ key[(i + iv[i % 16]) % 32];
  }
  return decrypted.toString('utf8');
}

// ------------------------------------------------------------------
// Customer org CRUD
// ------------------------------------------------------------------

export async function saveCustomerModel({ slug, orgName, orgId, model, password, pat }) {
  const database = await getDb();
  if (!database) {
    throw new Error('Database connection unavailable. Check MONGODB_URI env var.');
  }

  const now = new Date();
  const setFields = { orgName, orgId, model, lastRefreshed: now };

  // Only set password and pat on insert or if explicitly provided for update
  const setOnInsert = { discoveredAt: now, snapshots: [] };
  if (password) {
    setFields.passwordHash = hashPassword(password);
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
  return database.collection('customers').findOne({ slug });
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

// ------------------------------------------------------------------
// Track customer views
// ------------------------------------------------------------------

export async function recordCustomerView(slug) {
  const database = await getDb();
  if (!database) return;
  await database.collection('customers').updateOne(
    { slug },
    { $set: { lastViewedAt: new Date() }, $inc: { viewCount: 1 } }
  );
}

// ------------------------------------------------------------------
// Delete org and all related data
// ------------------------------------------------------------------

export async function deleteCustomerOrg(slug) {
  const database = await getDb();
  if (!database) {
    throw new Error('Database connection unavailable.');
  }

  // Delete the customer document
  await database.collection('customers').deleteOne({ slug });
  // Delete all share tokens for this org
  await database.collection('share_tokens').deleteMany({ slug });
  // Delete all annotations for this org
  await database.collection('annotations').deleteMany({ slug });

  return { deleted: slug };
}

// ------------------------------------------------------------------
// Snapshots (for diff view) - keep last 3
// ------------------------------------------------------------------

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
          $slice: -3, // keep only last 3
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

// ------------------------------------------------------------------
// Share tokens (time-limited read-only access)
// ------------------------------------------------------------------

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
  if (new Date() > doc.expiresAt) return null; // expired
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

export async function deleteShareToken(token) {
  const database = await getDb();
  if (!database) return;
  await database.collection('share_tokens').deleteOne({ token });
}

// ------------------------------------------------------------------
// Annotations
// ------------------------------------------------------------------

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

export async function deleteAnnotation(id) {
  const database = await getDb();
  if (!database) return;
  await database.collection('annotations').deleteOne({ id });
}
