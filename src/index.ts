/**
 * Custom error thrown when a Beamdrop API request fails.
 *
 * Every failed HTTP response from the Beamdrop server is wrapped in this
 * exception so callers can inspect the HTTP status code and the raw JSON
 * error body returned by the API.
 *
 * A `status` of `0` indicates a client‑side error such as a network failure
 * or request timeout (i.e. no HTTP response was received).
 *
 * @example
 * ```ts
 * try {
 *   await beamdrop.getObject('my-bucket', 'missing-key.txt');
 * } catch (err) {
 *   if (err instanceof BeamdropException && err.status === 404) {
 *     console.log('Object not found');
 *   }
 * }
 * ```
 */
export class BeamdropException extends Error {
  /** HTTP status code of the failed response, or `0` for client‑side errors. */
  public readonly status: number;

  /** Parsed JSON body from the error response, if available. */
  public readonly body?: Record<string, unknown>;

  /**
   * @param message - Human‑readable description of the error.
   * @param status  - HTTP status code (`0` when no response was received).
   * @param body    - Optional parsed JSON error body from the server.
   */
  constructor(message: string, status: number = 0, body?: Record<string, unknown>) {
    super(message);
    this.name = 'BeamdropException';
    this.status = status;
    this.body = body;
  }
}

// ----------------------------------------------------------------------
// Type definitions matching Beamdrop API responses
// ----------------------------------------------------------------------

/**
 * Basic bucket information returned by the Beamdrop server.
 *
 * Represents a single bucket entry as it appears in listing responses.
 */
export interface BucketInfo {
  /** Unique bucket name (3–63 lowercase alphanumeric characters, hyphens, or dots). */
  name: string;

  /** Timestamp when the bucket was created, in ISO 8601 format (e.g. `"2025-06-15T08:30:00Z"`). */
  createdAt: string;
}

/**
 * Response payload from {@link Beamdrop.listBuckets}.
 *
 * Contains the full list of buckets accessible to the authenticated API key.
 */
export interface ListBucketsResponse {
  /** Array of bucket information objects. */
  buckets: BucketInfo[];

  /** Total number of buckets returned. */
  count: number;
}

/**
 * Response payload from {@link Beamdrop.createBucket}.
 *
 * Returned after a bucket has been successfully created on the server.
 */
export interface CreateBucketResponse {
  /** Name of the newly created bucket. */
  bucket: string;

  /** Timestamp when the bucket was created, in ISO 8601 format. */
  created: string;

  /** Server‑relative location path of the new bucket (e.g. `"/api/v1/buckets/my-bucket"`). */
  location: string;
}

/**
 * Response payload from {@link Beamdrop.putObject}.
 *
 * Returned after an object has been successfully uploaded to a bucket.
 */
export interface PutObjectResponse {
  /** Bucket the object was stored in. */
  bucket: string;

  /** Full object key including any path separators (e.g. `"uploads/photo.jpg"`). */
  key: string;

  /** MD5 or SHA‑256 entity tag computed by the server for integrity verification. */
  etag: string;

  /** Size of the stored object in bytes. */
  size: number;

  /** Server‑relative URL path to the object (e.g. `"/api/v1/buckets/my-bucket/photo.jpg"`). */
  url: string;
}

/**
 * Object metadata extracted from HTTP response headers.
 *
 * Returned by {@link Beamdrop.headObject} (HEAD) and included in
 * {@link GetObjectResponse} (GET).
 */
export interface ObjectMetadata {
  /** MIME type of the object (e.g. `"image/png"`, `"application/octet-stream"`). */
  content_type: string;

  /** Size of the object in bytes. */
  content_length: number;

  /** Entity tag for cache validation and integrity checks. */
  etag: string;

  /** Timestamp of the last modification in ISO 8601 format. */
  last_modified: string;
}

/**
 * Response from {@link Beamdrop.getObject} – includes the raw file body
 * together with all metadata from the response headers.
 *
 * **Note:** The `body` is returned as a UTF‑8 string via `response.text()`.
 * For binary files (images, archives, etc.) the content may be corrupted;
 * consider downloading through a presigned URL for binary payloads.
 */
export interface GetObjectResponse extends ObjectMetadata {
  /** Raw file content as a UTF‑8 string. */
  body: string;
}

/**
 * Summary information for a single object as returned in
 * {@link ListObjectsResponse.contents}.
 */
export interface ObjectInfo {
  /** Full object key (may contain `/` path separators). */
  key: string;

  /** Size of the object in bytes. */
  size: number;

  /** Timestamp of the last modification in ISO 8601 format. */
  lastModified: string;

  /** Entity tag for cache validation and integrity checks. */
  etag: string;
}

/**
 * Response payload from {@link Beamdrop.listObjects}.
 *
 * Supports prefix/delimiter‑based filtering for hierarchical key navigation
 * (similar to S3 `ListObjectsV2`).
 */
export interface ListObjectsResponse {
  /** Bucket that was listed. */
  bucket: string;

  /** The prefix filter that was applied, or `""` if none. */
  prefix: string;

  /** The delimiter used for grouping, or `""` if none. */
  delimiter: string;

  /** Maximum number of keys that were requested (1–1000). */
  maxKeys: number;

  /** `true` when there are more results beyond `maxKeys`; paginate to retrieve them. */
  isTruncated: boolean;

  /** Array of objects matching the listing criteria. */
  contents: ObjectInfo[];

  /**
   * Array of key prefixes that act as "virtual directories" when a
   * `delimiter` is specified (e.g. `["photos/", "docs/"]`).
   */
  commonPrefixes: string[];
}

/**
 * Detailed information about a server‑managed pretty presigned URL.
 *
 * Pretty presigned URLs are short, human‑friendly download links
 * (e.g. `https://files.example.com/dl/abc123`) that are tracked and
 * rate‑limited on the server.
 */
export interface PrettyPresignedUrlInfo {
  /** Unique opaque token identifying this presigned URL. */
  token: string;

  /** Full download URL (e.g. `"https://files.example.com/dl/abc123"`). */
  url: string;

  /** Bucket the presigned URL points to. */
  bucket: string;

  /** Object key the presigned URL points to. */
  key: string;

  /** HTTP method the URL is valid for (typically `"GET"`). */
  method: string;

  /** Expiry timestamp in ISO 8601 format, or `null` if the URL never expires. */
  expiresAt: string | null;

  /** Maximum allowed downloads before the URL is revoked, or `null` for unlimited. */
  maxDownloads: number | null;

  /** Timestamp when the presigned URL was created, in ISO 8601 format. */
  createdAt: string;
}

/**
 * Response payload from {@link Beamdrop.createPrettyPresignedUrl}.
 *
 * Identical in shape to {@link PrettyPresignedUrlInfo} — includes the
 * generated token, full download URL, and all associated metadata.
 */
export type CreatePrettyPresignedUrlResponse = PrettyPresignedUrlInfo;

/**
 * Response payload from {@link Beamdrop.listPrettyPresignedUrls}.
 *
 * Contains every active (non‑revoked) pretty presigned URL managed by the server.
 */
export interface ListPrettyPresignedUrlsResponse {
  /** Array of active pretty presigned URL records. */
  urls: PrettyPresignedUrlInfo[];

  /** Total number of URLs returned. */
  count: number;
}

// ----------------------------------------------------------------------
// Main client class
// ----------------------------------------------------------------------

/**
 * Beamdrop – TypeScript client for the Beamdrop S3‑compatible API.
 *
 * Provides a high‑level, strongly‑typed interface to the Beamdrop file‑sharing
 * server. Every request is authenticated with HMAC‑SHA256 request signing
 * (similar to AWS Signature v4) using the provided access/secret key pair.
 *
 * **Features:**
 * - Full bucket CRUD (create, delete, list, exists check)
 * - Object upload, download, delete, HEAD, and prefix‑based listing
 * - Client‑side HMAC presigned URL generation (no server round‑trip)
 * - Server‑side pretty presigned URL management (create, list, revoke)
 * - Automatic request timeout via `AbortController`
 *
 * **Authentication:**
 * Every request includes an `Authorization: Bearer {accessKey}:{signature}`
 * header and an `X-Beamdrop-Date` timestamp header. The signature is
 * `Base64(HMAC-SHA256(secretKey, "METHOD\nPATH\nTIMESTAMP"))`.
 *
 * @example
 * ```ts
 * import { Beamdrop, BeamdropException } from 'beamdrop';
 *
 * const client = new Beamdrop({
 *   baseUrl: 'https://files.example.com',
 *   accessKey: 'BDK_abc123',
 *   secretKey: 'sk_secret',
 * });
 *
 * // Create a bucket and upload a file
 * await client.createBucket('avatars');
 * await client.putObject('avatars', 'user-1/photo.jpg', fileBuffer);
 *
 * // Generate a presigned download URL valid for 1 hour
 * const url = await client.presignedUrl('avatars', 'user-1/photo.jpg', 3600);
 * console.log(url);
 * ```
 */
export class Beamdrop {
  /** Base URL of the Beamdrop server (trailing slash removed). */
  private readonly baseUrl: string;

  /** API access key ID (typically starts with `BDK_`). */
  private readonly accessKey: string;

  /** API secret key used for HMAC‑SHA256 request signing. */
  private readonly secretKey: string;

  /**
   * Connection timeout in milliseconds.
   * @remarks Currently declared for future use; the Web Fetch API does not
   *          support a separate connection‑level timeout.
   */
  private readonly connectTimeout: number;

  /** Total request timeout in milliseconds (applied via `AbortController`). */
  private readonly timeout: number;

  /**
   * Create a new Beamdrop client.
   *
   * @param options                - Configuration for the client.
   * @param options.baseUrl        - Base URL of the Beamdrop server (trailing slash is stripped automatically).
   * @param options.accessKey      - API access key ID (starts with `BDK_`).
   * @param options.secretKey      - API secret key (starts with `sk_`), used for HMAC‑SHA256 signing.
   * @param options.connectTimeout - Connection timeout in milliseconds. Defaults to `10_000` (10 s).
   *                                 Reserved for future use; not enforced by the Web Fetch API.
   * @param options.timeout        - Total request timeout in milliseconds. Defaults to `120_000` (2 min).
   *                                 If a request takes longer, it is aborted and a
   *                                 {@link BeamdropException} with `status === 0` is thrown.
   *
   * @example
   * ```ts
   * const client = new Beamdrop({
   *   baseUrl: 'https://files.example.com',
   *   accessKey: 'BDK_abc123',
   *   secretKey: 'sk_secret',
   *   timeout: 30_000, // 30 seconds
   * });
   * ```
   */
  constructor(options: {
    baseUrl: string;
    accessKey: string;
    secretKey: string;
    connectTimeout?: number;
    timeout?: number;
  }) {
    this.baseUrl = options.baseUrl.replace(/\/$/, '');
    this.accessKey = options.accessKey;
    this.secretKey = options.secretKey;
    this.connectTimeout = options.connectTimeout ?? 10000;
    this.timeout = options.timeout ?? 120000;
  }

  // --------------------------------------------------------------------
  // Bucket operations
  // --------------------------------------------------------------------

  /**
   * Create a new storage bucket.
   *
   * Bucket names must be 3–63 characters long and may only contain
   * lowercase alphanumeric characters, hyphens (`-`), and dots (`.`).
   *
   * @param name - Desired bucket name.
   * @returns Metadata about the newly created bucket.
   * @throws {BeamdropException} `409 Conflict` if a bucket with the same name already exists.
   *
   * @example
   * ```ts
   * const result = await client.createBucket('user-uploads');
   * console.log(result.location); // "/api/v1/buckets/user-uploads"
   * ```
   */
  async createBucket(name: string): Promise<CreateBucketResponse> {
    return this.request('PUT', `/api/v1/buckets/${name}`);
  }

  /**
   * Delete an empty bucket.
   *
   * The bucket must contain no objects; attempting to delete a non‑empty
   * bucket results in a `409 Conflict` error.
   *
   * @param name - Name of the bucket to delete.
   * @returns `true` on successful deletion.
   * @throws {BeamdropException} `404 Not Found` if the bucket does not exist.
   * @throws {BeamdropException} `409 Conflict` if the bucket is not empty.
   *
   * @example
   * ```ts
   * await client.deleteBucket('old-uploads');
   * ```
   */
  async deleteBucket(name: string): Promise<true> {
    await this.request('DELETE', `/api/v1/buckets/${name}`);
    return true;
  }

  /**
   * List all buckets accessible to the authenticated API key.
   *
   * @returns An object containing an array of {@link BucketInfo} entries
   *          and a `count` of total buckets.
   *
   * @example
   * ```ts
   * const { buckets, count } = await client.listBuckets();
   * buckets.forEach(b => console.log(b.name, b.createdAt));
   * ```
   */
  async listBuckets(): Promise<ListBucketsResponse> {
    return this.request('GET', '/api/v1/buckets');
  }

  /**
   * Check whether a bucket exists.
   *
   * Uses a HEAD request so no response body is transferred. Returns `false`
   * for a `404` response and re‑throws any other errors.
   *
   * @param name - Bucket name to check.
   * @returns `true` if the bucket exists, `false` otherwise.
   *
   * @example
   * ```ts
   * if (await client.bucketExists('avatars')) {
   *   console.log('Bucket is ready');
   * }
   * ```
   */
  async bucketExists(name: string): Promise<boolean> {
    try {
      await this.request('HEAD', `/api/v1/buckets/${name}`);
      return true;
    } catch (err) {
      if (err instanceof BeamdropException && err.status === 404) {
        return false;
      }
      throw err;
    }
  }

  // --------------------------------------------------------------------
  // Object operations
  // --------------------------------------------------------------------

  /**
   * Upload an object (file) to a bucket.
   *
   * The object key may include path separators (`/`) to emulate a directory
   * hierarchy; the server stores them flat but supports prefix‑based listing.
   *
   * Content‑Type is auto‑detected as `application/json` when `body` is a
   * string starting with `{` or `[`, and `application/octet-stream` otherwise.
   *
   * @param bucket - Target bucket name.
   * @param key    - Object key (e.g. `"photos/vacation/img_001.jpg"`).
   * @param body   - Raw file content. Accepts any `BodyInit` value:
   *                 `string`, `Blob`, `ArrayBuffer`, `ReadableStream`, etc.
   * @returns Metadata about the stored object, including its `etag` and `size`.
   * @throws {BeamdropException} `404` if the bucket does not exist.
   * @throws {BeamdropException} `423 Locked` if the object is locked.
   * @throws {BeamdropException} `429 Too Many Requests` if rate‑limited.
   *
   * @example
   * ```ts
   * const result = await client.putObject('avatars', 'user-1/photo.jpg', fileBuffer);
   * console.log(`Uploaded ${result.size} bytes, etag: ${result.etag}`);
   * ```
   */
  async putObject(
    bucket: string,
    key: string,
    body: BodyInit
  ): Promise<PutObjectResponse> {
    return this.request('PUT', `/api/v1/buckets/${bucket}/${key}`, body);
  }

  /**
   * Download an object – returns the raw file body together with response‑header metadata.
   *
   * The body is read as a UTF‑8 `string` via `response.text()`. For binary
   * payloads (images, archives, etc.) the content may be corrupted; prefer
   * downloading through a presigned URL for binary files.
   *
   * @param bucket - Bucket name.
   * @param key    - Object key.
   * @returns A {@link GetObjectResponse} containing the file body and metadata
   *          (`content_type`, `content_length`, `etag`, `last_modified`).
   * @throws {BeamdropException} `404 Not Found` if the object does not exist.
   *
   * @example
   * ```ts
   * const obj = await client.getObject('configs', 'app/settings.json');
   * const settings = JSON.parse(obj.body);
   * console.log(`Content-Type: ${obj.content_type}, Size: ${obj.content_length}`);
   * ```
   */
  async getObject(bucket: string, key: string): Promise<GetObjectResponse> {
    return await this.rawRequest('GET', `/api/v1/buckets/${bucket}/${key}`) as GetObjectResponse;
  }

  /**
   * Delete an object from a bucket.
   *
   * @param bucket - Bucket name.
   * @param key    - Object key to delete.
   * @returns `true` on successful deletion.
   * @throws {BeamdropException} `404 Not Found` if the object does not exist.
   * @throws {BeamdropException} `423 Locked` if the object is locked.
   *
   * @example
   * ```ts
   * await client.deleteObject('avatars', 'user-1/old-photo.jpg');
   * ```
   */
  async deleteObject(bucket: string, key: string): Promise<true> {
    await this.request('DELETE', `/api/v1/buckets/${bucket}/${key}`);
    return true;
  }

  /**
   * Retrieve object metadata without downloading the body (HEAD request).
   *
   * Useful for checking an object’s size, content type, or last‑modified
   * date before deciding whether to download the full content.
   *
   * @param bucket - Bucket name.
   * @param key    - Object key.
   * @returns An {@link ObjectMetadata} object with `content_type`,
   *          `content_length`, `etag`, and `last_modified` fields.
   * @throws {BeamdropException} `404 Not Found` if the object does not exist.
   *
   * @example
   * ```ts
   * const meta = await client.headObject('docs', 'report.pdf');
   * console.log(`Size: ${meta.content_length}, Type: ${meta.content_type}`);
   * ```
   */
  async headObject(bucket: string, key: string): Promise<ObjectMetadata> {
    return await this.rawRequest('HEAD', `/api/v1/buckets/${bucket}/${key}`);
  }

  /**
   * Check whether an object exists in a bucket.
   *
   * Internally performs a HEAD request via {@link headObject}. Returns
   * `false` for a `404` response and re‑throws any other errors.
   *
   * @param bucket - Bucket name.
   * @param key    - Object key to check.
   * @returns `true` if the object exists, `false` otherwise.
   *
   * @example
   * ```ts
   * if (await client.objectExists('avatars', 'user-1/photo.jpg')) {
   *   console.log('File is already uploaded');
   * }
   * ```
   */
  async objectExists(bucket: string, key: string): Promise<boolean> {
    try {
      await this.headObject(bucket, key);
      return true;
    } catch (err) {
      if (err instanceof BeamdropException && err.status === 404) {
        return false;
      }
      throw err;
    }
  }

  /**
   * List objects in a bucket with optional prefix and delimiter filtering.
   *
   * Works similarly to S3’s `ListObjectsV2`. When a `delimiter` is provided
   * (typically `"/"`), keys that share a common prefix up to the delimiter
   * are grouped into {@link ListObjectsResponse.commonPrefixes}, enabling
   * virtual‑directory navigation.
   *
   * Internally sets the `list=true` query parameter, which is required by
   * the Beamdrop server to enter object‑listing mode.
   *
   * @param bucket    - Bucket name.
   * @param prefix    - Only return keys starting with this prefix (e.g. `"photos/2025/"`).
   * @param delimiter - Character used to group keys into common prefixes (usually `"/"`).
   * @param maxKeys   - Maximum number of results to return, between 1 and 1000.
   *                    Defaults to `1000`.
   * @returns A {@link ListObjectsResponse} with matching objects and common prefixes.
   *
   * @example
   * ```ts
   * // List all objects under the "photos/" prefix
   * const result = await client.listObjects('media', 'photos/', '/');
   * console.log('Files:', result.contents.map(o => o.key));
   * console.log('Folders:', result.commonPrefixes);
   * ```
   */
  async listObjects(
    bucket: string,
    prefix?: string,
    delimiter?: string,
    maxKeys = 1000
  ): Promise<ListObjectsResponse> {
    const params = new URLSearchParams();
    params.set('list', 'true'); // required to trigger list mode on the server
    if (prefix !== undefined) params.set('prefix', prefix);
    if (delimiter !== undefined) params.set('delimiter', delimiter);
    if (maxKeys !== 1000) params.set('max-keys', maxKeys.toString());

    const query = params.toString();
    const path = `/api/v1/buckets/${bucket}${query ? '?' + query : ''}`;
    return this.request('GET', path);
  }

  // --------------------------------------------------------------------
  // Presigned URLs (client‑side HMAC)
  // --------------------------------------------------------------------

  /**
   * Generate a client‑side HMAC presigned URL for accessing an object.
   *
   * The presigned token is computed entirely on the client using the secret
   * key — **no server round‑trip is required**. The resulting URL can be
   * shared with unauthenticated users to grant temporary access to the file.
   *
   * **Token format:**
   * ```
   * Base64URL(HMAC-SHA256(secretKey, "METHOD\nBUCKET\nKEY\nUNIX_TIMESTAMP"))
   * ```
   *
   * The URL includes `token`, `expires` (ISO 8601), and `access_key` as
   * query parameters for the server to verify.
   *
   * @param bucket    - Bucket name.
   * @param key       - Object key.
   * @param expiresIn - Number of seconds until the URL expires (e.g. `3600` = 1 hour).
   * @param method    - HTTP method the URL is valid for. Defaults to `"GET"`.
   * @returns The fully‑qualified presigned URL as a string.
   *
   * @example
   * ```ts
   * // Generate a download link valid for 24 hours
   * const url = await client.presignedUrl('docs', 'report.pdf', 86400);
   * console.log(url);
   * // => "https://files.example.com/api/v1/buckets/docs/report.pdf?token=...&expires=...&access_key=..."
   * ```
   */
  async presignedUrl(
    bucket: string,
    key: string,
    expiresIn: number,
    method = 'GET'
  ): Promise<string> {
    const expiresAt = Math.floor(Date.now() / 1000) + expiresIn; // Unix timestamp
    const expiresAtISO = new Date(expiresAt * 1000).toISOString().replace(/\.\d{3}Z$/, 'Z');

    // Token = Base64URL(HMAC-SHA256("METHOD\nBUCKET\nKEY\nUNIX_TIMESTAMP", secretKey))
    const message = `${method}\n${bucket}\n${key}\n${expiresAt}`;
    const token = await this.hmacSha256Base64Url(this.secretKey, message);

    const path = `/api/v1/buckets/${bucket}/${key}`;
    const query = new URLSearchParams({
      token,
      expires: expiresAtISO,
      access_key: this.accessKey,
    }).toString();

    return `${this.baseUrl}${path}?${query}`;
  }

  // --------------------------------------------------------------------
  // Server‑side pretty presigned URLs (registry)
  // --------------------------------------------------------------------

  /**
   * Create a server‑managed pretty presigned URL.
   *
   * Unlike client‑side presigned URLs (see {@link presignedUrl}), pretty
   * presigned URLs are registered on the server and produce short,
   * human‑friendly download links (e.g. `https://files.example.com/dl/abc123`).
   * The server can enforce download limits and expiration policies.
   *
   * @param bucket       - Bucket name.
   * @param key          - Object key.
   * @param expiresIn    - Seconds until the URL expires, or `null`/`undefined`
   *                       for a URL that never expires.
   * @param maxDownloads - Maximum number of downloads before the URL is
   *                       automatically revoked, or `null`/`undefined` for unlimited.
   * @param method       - HTTP method the URL is valid for. Defaults to `"GET"`.
   * @returns A {@link CreatePrettyPresignedUrlResponse} with the generated
   *          token, full download URL, and associated metadata.
   * @throws {BeamdropException} On any server‑side failure.
   *
   * @example
   * ```ts
   * // Create a link that expires in 7 days and allows at most 100 downloads
   * const link = await client.createPrettyPresignedUrl(
   *   'reports', 'q4-results.pdf', 7 * 86400, 100,
   * );
   * console.log(link.url); // "https://files.example.com/dl/x7kQ9m"
   * ```
   */
  async createPrettyPresignedUrl(
    bucket: string,
    key: string,
    expiresIn?: number | null,
    maxDownloads?: number | null,
    method = 'GET'
  ): Promise<CreatePrettyPresignedUrlResponse> {
    const payload: Record<string, unknown> = { bucket, key, method };
    if (expiresIn != null) payload.expiresIn = expiresIn;
    if (maxDownloads != null) payload.maxDownloads = maxDownloads;

    return this.request('POST', '/api/v1/presign', JSON.stringify(payload));
  }

  /**
   * Revoke (delete) a server‑managed pretty presigned URL.
   *
   * Once revoked, the short download link immediately stops working.
   *
   * @param token - The opaque token identifying the presigned URL to revoke.
   * @returns `true` on successful revocation.
   * @throws {BeamdropException} `404 Not Found` if the token does not exist.
   *
   * @example
   * ```ts
   * await client.revokePrettyPresignedUrl('x7kQ9m');
   * ```
   */
  async revokePrettyPresignedUrl(token: string): Promise<true> {
    await this.request('DELETE', `/api/v1/presign/${token}`);
    return true;
  }

  /**
   * List all active server‑managed pretty presigned URLs.
   *
   * Returns every non‑revoked pretty presigned URL that has been created,
   * including any that may have expired but have not yet been cleaned up.
   *
   * @returns A {@link ListPrettyPresignedUrlsResponse} with the full array
   *          of URLs and a total count.
   *
   * @example
   * ```ts
   * const { urls, count } = await client.listPrettyPresignedUrls();
   * console.log(`${count} active presigned URLs`);
   * urls.forEach(u => console.log(u.token, u.url, u.expiresAt));
   * ```
   */
  async listPrettyPresignedUrls(): Promise<ListPrettyPresignedUrlsResponse> {
    return this.request('GET', '/api/v1/presign');
  }

  // --------------------------------------------------------------------
  // Internal HTTP methods with request signing
  // --------------------------------------------------------------------

  /**
   * Send an authenticated request and parse the response as JSON.
   *
   * Handles the full request lifecycle: signing, sending, status checking,
   * and JSON parsing. A `204 No Content` response returns an empty object.
   * Non‑2xx responses are thrown as {@link BeamdropException}.
   *
   * @typeParam T - Expected shape of the parsed JSON response.
   * @param method - HTTP method (e.g. `"GET"`, `"PUT"`, `"DELETE"`).
   * @param path   - Server‑relative path including any query string
   *                 (e.g. `"/api/v1/buckets/my-bucket?list=true"`).
   * @param body   - Optional request body (`BodyInit`).
   * @returns The parsed JSON response cast to `T`.
   * @throws {BeamdropException} For any non‑2xx HTTP status.
   *
   * @internal
   */
  private async request<T = any>(
    method: string,
    path: string,
    body?: BodyInit
  ): Promise<T> {
    const { status, responseBody, headers } = await this.sendRequest(method, path, body);

    // 204 No Content – return empty object
    if (status === 204) {
      return {} as T;
    }

    // Try to parse JSON
    let parsed: any;
    try {
      parsed = JSON.parse(responseBody);
    } catch {
      parsed = {};
    }

    // Error responses
    if (status < 200 || status >= 300) {
      const message =
        parsed.error?.message ?? parsed.message ?? `Beamdrop request failed with status ${status}`;
      throw new BeamdropException(message, status, parsed);
    }

    return parsed as T;
  }

  /**
   * Send an authenticated request and return raw content with HTTP‑header metadata.
   *
   * Used by {@link getObject} (GET) and {@link headObject} (HEAD). For GET
   * requests the response body is included; for HEAD it is omitted.
   *
   * Metadata (`content_type`, `content_length`, `etag`, `last_modified`)
   * is extracted directly from the response headers.
   *
   * @param method - HTTP method (`"GET"` or `"HEAD"`).
   * @param path   - Server‑relative path to the object.
   * @returns A {@link GetObjectResponse} (GET) or {@link ObjectMetadata} (HEAD).
   * @throws {BeamdropException} For any non‑2xx HTTP status.
   *
   * @internal
   */
  private async rawRequest(
    method: string,
    path: string
  ): Promise<GetObjectResponse | ObjectMetadata> {
    const { status, responseBody, headers } = await this.sendRequest(method, path);

    if (status < 200 || status >= 300) {
      let parsed: any = {};
      try {
        parsed = JSON.parse(responseBody);
      } catch { }
      const message =
        parsed.error?.message ?? `Beamdrop request failed with status ${status}`;
      throw new BeamdropException(message, status, parsed);
    }

    const result: any = {
      content_type: headers.get('content-type') ?? 'application/octet-stream',
      content_length: parseInt(headers.get('content-length') ?? '0', 10),
      etag: (headers.get('etag') ?? '').replace(/^"(.*)"$/, '$1'), // strip quotes
      last_modified: headers.get('last-modified') ?? '',
    };

    if (method !== 'HEAD') {
      result.body = responseBody;
    }

    return result;
  }

  /**
   * Low‑level HTTP fetch with HMAC‑SHA256 request signing and timeout.
   *
   * Constructs the `Authorization` and `X-Beamdrop-Date` headers, applies
   * content‑type detection for string bodies, and enforces the configured
   * {@link timeout} via `AbortController`.
   *
   * **Signature algorithm:**
   * ```
   * stringToSign = "METHOD\nPATHNAME\nTIMESTAMP"
   * signature    = Base64(HMAC-SHA256(secretKey, stringToSign))
   * Authorization: Bearer {accessKey}:{signature}
   * ```
   *
   * @param method - HTTP method.
   * @param path   - Server‑relative path (may include query string;
   *                 only the pathname portion is signed).
   * @param body   - Optional request body.
   * @returns An object containing the HTTP `status`, the response body as
   *          a `string`, and the response `Headers`.
   * @throws {BeamdropException} `status=0` on timeout (`AbortError`) or
   *         network failure.
   *
   * @internal
   */
  private async sendRequest(
    method: string,
    path: string,
    body?: BodyInit
  ): Promise<{ status: number; responseBody: string; headers: Headers }> {
    // Build the signed headers
    const signPath = new URL(path, this.baseUrl).pathname; // strip query string for signature
    const timestamp = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'); // RFC 3339, no milliseconds

    const stringToSign = `${method}\n${signPath}\n${timestamp}`;
    const signature = await this.hmacSha256Base64(this.secretKey, stringToSign);

    const headers = new Headers({
      Authorization: `Bearer ${this.accessKey}:${signature}`,
      'X-Beamdrop-Date': timestamp,
    });

    if (body) {
      // Simple content‑type detection: assume JSON if body is a string that starts with '{' or '['
      const isJson = typeof body === 'string' && (body.startsWith('{') || body.startsWith('['));
      headers.set('Content-Type', isJson ? 'application/json' : 'application/octet-stream');
      // Content‑Length will be set automatically by fetch if possible, or we can add it
    }

    const url = this.baseUrl + path;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        method,
        headers,
        body: body ?? null,
        signal: controller.signal,
      });

      const responseBody = await response.text();
      return {
        status: response.status,
        responseBody,
        headers: response.headers,
      };
    } catch (error: any) {
      if (error.name === 'AbortError') {
        throw new BeamdropException(`Request timeout after ${this.timeout}ms`, 0);
      }
      throw new BeamdropException(`Network error: ${error.message}`, 0);
    } finally {
      clearTimeout(timeoutId);
    }
  }

  // --------------------------------------------------------------------
  // Cryptographic helpers
  // --------------------------------------------------------------------

  /**
   * Compute an HMAC‑SHA256 digest and return it as a standard Base64 string.
   *
   * Uses the Web Crypto API (`crypto.subtle`) which is available in modern
   * browsers, Node.js ≥ 15, Deno, and Cloudflare Workers.
   *
   * @param secret  - The HMAC secret key (UTF‑8 string).
   * @param message - The message to sign (UTF‑8 string).
   * @returns Standard Base64‑encoded HMAC‑SHA256 signature.
   *
   * @internal
   */
  private async hmacSha256Base64(secret: string, message: string): Promise<string> {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(message));
    return btoa(String.fromCharCode(...new Uint8Array(signature)));
  }

  /**
   * Compute an HMAC‑SHA256 digest and return it as URL‑safe Base64
   * (`+` → `-`, `/` → `_`, padding preserved).
   *
   * The Beamdrop server’s `GeneratePresignedToken` uses Go’s
   * `base64.URLEncoding` which **includes** padding (`=`), so padding
   * must not be stripped here.
   *
   * Used exclusively for presigned URL token generation.
   *
   * @param secret  - The HMAC secret key (UTF‑8 string).
   * @param message - The message to sign (UTF‑8 string).
   * @returns URL‑safe Base64‑encoded HMAC‑SHA256 signature (with padding).
   *
   * @internal
   */
  private async hmacSha256Base64Url(secret: string, message: string): Promise<string> {
    const base64 = await this.hmacSha256Base64(secret, message);
    return base64.replace(/\+/g, '-').replace(/\//g, '_'); // keep padding — server uses base64.URLEncoding WITH padding
  }
}