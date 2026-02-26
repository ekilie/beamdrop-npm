# beamdrop

Official TypeScript/JavaScript client for [Beamdrop](https://github.com/ekilie/beamdrop) — a lightweight, self-hosted file sharing server with an S3-compatible API.

## Features

- Full **bucket** operations — create, create-if-not-exists (idempotent), delete, list, exists check
- **Object** upload, download, delete, HEAD, and prefix-based listing
- **Client-side presigned URLs** — HMAC-SHA256 tokens generated locally, no server round-trip
- **Server-side pretty presigned URLs** — short, human-friendly download links with expiry and download limits
- HMAC-SHA256 request signing (similar to AWS Signature v4)
- Zero runtime dependencies — uses the built-in `fetch` and Web Crypto APIs
- Works in Node.js ≥ 18, Deno, Bun, and Cloudflare Workers

## Installation

```bash
npm install beamdrop
```

## Quick Start

```ts
import { Beamdrop } from 'beamdrop';

const client = new Beamdrop({
  baseUrl: 'https://files.example.com',
  accessKey: 'BDK_abc123',
  secretKey: 'sk_secret',
});

// Create a bucket
await client.createBucket('avatars');

// Upload a file
const result = await client.putObject('avatars', 'user-1/photo.jpg', fileBuffer);
console.log(`Uploaded ${result.size} bytes`);

// Download a file
const obj = await client.getObject('avatars', 'user-1/photo.jpg');
console.log(obj.content_type, obj.content_length);

// Generate a presigned download URL (valid for 1 hour)
const url = await client.presignedUrl('avatars', 'user-1/photo.jpg', 3600);
console.log(url);
```

## API Reference

### Constructor

```ts
new Beamdrop(options)
```

| Option           | Type     | Default    | Description                                        |
| ---------------- | -------- | ---------- | -------------------------------------------------- |
| `baseUrl`        | `string` | —          | Base URL of your Beamdrop server                   |
| `accessKey`      | `string` | —          | API access key (starts with `BDK_`)                |
| `secretKey`      | `string` | —          | API secret key (starts with `sk_`)                 |
| `connectTimeout` | `number` | `10000`    | Connection timeout in ms (reserved for future use) |
| `timeout`        | `number` | `120000`   | Total request timeout in ms                        |

### Buckets

```ts
// Create a bucket
await client.createBucket('my-bucket');

// Create if missing (idempotent; never throws 409 for existing bucket)
const ensured = await client.createBucketIfNotExists('my-bucket');
if ('exists' in ensured) {
  console.log('Bucket already existed');
}

// Delete an empty bucket
await client.deleteBucket('my-bucket');

// List all buckets
const { buckets, count } = await client.listBuckets();

// Check if a bucket exists
const exists = await client.bucketExists('my-bucket');
```

### Objects

```ts
// Upload an object
const result = await client.putObject('bucket', 'path/to/file.txt', body);

// Download an object (body + metadata)
const obj = await client.getObject('bucket', 'path/to/file.txt');

// Get metadata only (HEAD)
const meta = await client.headObject('bucket', 'path/to/file.txt');

// Check if an object exists
const exists = await client.objectExists('bucket', 'path/to/file.txt');

// Delete an object
await client.deleteObject('bucket', 'path/to/file.txt');

// List objects with prefix/delimiter filtering
const listing = await client.listObjects('bucket', 'photos/', '/');
console.log(listing.contents);       // objects
console.log(listing.commonPrefixes); // "subdirectories"
```

### Presigned URLs (client-side)

Generate HMAC-signed download URLs locally — no server round-trip:

```ts
const url = await client.presignedUrl('bucket', 'file.txt', 3600); // 1 hour
```

### Pretty Presigned URLs (server-side)

Short, trackable download links managed by the server:

```ts
// Create (expires in 7 days, max 100 downloads)
const link = await client.createPrettyPresignedUrl(
  'bucket', 'file.txt', 7 * 86400, 100,
);
console.log(link.url); // "https://files.example.com/dl/x7kQ9m"

// List all active pretty presigned URLs
const { urls } = await client.listPrettyPresignedUrls();

// Revoke a pretty presigned URL
await client.revokePrettyPresignedUrl('x7kQ9m');
```

## Error Handling

All API errors throw a `BeamdropException` with the HTTP status code and parsed error body:

```ts
import { Beamdrop, BeamdropException } from 'beamdrop';

try {
  await client.getObject('bucket', 'missing.txt');
} catch (err) {
  if (err instanceof BeamdropException) {
    console.error(err.status);  // 404
    console.error(err.message); // "Object not found"
    console.error(err.body);    // full JSON error body
  }
}
```

A `status` of `0` indicates a client-side error (network failure or request timeout).

## License

[MIT](LICENSE)
