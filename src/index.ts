/**
 * Custom error thrown when a Beamdrop API request fails.
 * Carries the HTTP status code and the parsed JSON error body.
 */
export class BeamdropException extends Error {
  public readonly status: number;
  public readonly body?: Record<string, unknown>;

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

/** Basic bucket information */
export interface BucketInfo {
  name: string;
  createdAt: string; // ISO 8601 timestamp
}

/** Response from listing buckets */
export interface ListBucketsResponse {
  buckets: BucketInfo[];
  count: number;
}

/** Response from creating a bucket */
export interface CreateBucketResponse {
  bucket: string;
  created: string; // ISO 8601
  location: string;
}

/** Response from uploading an object (PUT / POST) */
export interface PutObjectResponse {
  bucket: string;
  key: string;
  etag: string;
  size: number;
  url: string; // relative path to the object
}

/** Object metadata (as returned by HEAD / GET) */
export interface ObjectMetadata {
  content_type: string;
  content_length: number;
  etag: string;
  last_modified: string; // ISO 8601
}

/** Response from downloading an object (raw) – includes body */
export interface GetObjectResponse extends ObjectMetadata {
  body: string; // raw file content
}

/** Object info used in listings */
export interface ObjectInfo {
  key: string;
  size: number;
  lastModified: string; // ISO 8601
  etag: string;
}

/** Response from listing objects (with optional prefix/delimiter) */
export interface ListObjectsResponse {
  bucket: string;
  prefix: string;
  delimiter: string;
  maxKeys: number;
  isTruncated: boolean;
  contents: ObjectInfo[];
  commonPrefixes: string[];
}

/** Server‑side pretty presigned URL information */
export interface PrettyPresignedUrlInfo {
  token: string;
  url: string; // full download URL (e.g. https://…/dl/{token})
  bucket: string;
  key: string;
  method: string; // e.g. "GET"
  expiresAt: string | null; // ISO 8601 or null
  maxDownloads: number | null;
  createdAt: string; // ISO 8601
}

/** Response from creating a pretty presigned URL */
export type CreatePrettyPresignedUrlResponse = PrettyPresignedUrlInfo;

/** Response from listing pretty presigned URLs */
export interface ListPrettyPresignedUrlsResponse {
  urls: PrettyPresignedUrlInfo[];
  count: number;
}

// ----------------------------------------------------------------------
// Main client class
// ----------------------------------------------------------------------

/**
 * Beamdrop – TypeScript client for the Beamdrop S3‑compatible API.
 *
 * Handles HMAC‑SHA256 request signing, presigned URL generation,
 * and all bucket / object operations.
 *
 * @example
 * const beamdrop = new Beamdrop({
 *   baseUrl: 'https://files.example.com',
 *   accessKey: 'BDK_abc123',
 *   secretKey: 'sk_secret',
 * });
 *
 * await beamdrop.createBucket('avatars');
 * await beamdrop.putObject('avatars', 'user-1/photo.jpg', fileBuffer);
 * const url = beamdrop.presignedUrl('avatars', 'user-1/photo.jpg', 3600);
 */
export class Beamdrop {
  private readonly baseUrl: string;
  private readonly accessKey: string;
  private readonly secretKey: string;
  private readonly connectTimeout: number;
  private readonly timeout: number;

  /**
   * @param options.baseUrl        Base URL of the Beamdrop server (no trailing slash).
   * @param options.accessKey      API access key ID (starts with BDK_).
   * @param options.secretKey      API secret key (starts with sk_).
   * @param options.connectTimeout Connection timeout in milliseconds (default: 10000).
   * @param options.timeout        Total request timeout in milliseconds (default: 120000).
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
   * Create a new bucket.
   * @param name Bucket name (3‑63 lowercase alphanumeric, hyphens, dots).
   * @throws {BeamdropException} 409 if the bucket already exists.
   */
  async createBucket(name: string): Promise<CreateBucketResponse> {
    return this.request('PUT', `/api/v1/buckets/${name}`);
  }

  /**
   * Delete an empty bucket.
   * @param name Bucket name.
   * @throws {BeamdropException} 404 if not found, 409 if not empty.
   */
  async deleteBucket(name: string): Promise<true> {
    await this.request('DELETE', `/api/v1/buckets/${name}`);
    return true;
  }

  /**
   * List all buckets.
   */
  async listBuckets(): Promise<ListBucketsResponse> {
    return this.request('GET', '/api/v1/buckets');
  }

  /**
   * Check whether a bucket exists (uses HEAD, no body).
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
   * Upload a file (raw bytes).
   * @param bucket Bucket name.
   * @param key    Object key (may contain slashes).
   * @param body   Raw file content (string, Buffer, Blob, etc.)
   * @throws {BeamdropException} 404 bucket not found, 423 locked, 429 rate limited.
   */
  async putObject(
    bucket: string,
    key: string,
    body: BodyInit
  ): Promise<PutObjectResponse> {
    return this.request('PUT', `/api/v1/buckets/${bucket}/${key}`, body);
  }

  /**
   * Download a file – returns raw body and metadata.
   * @param bucket Bucket name.
   * @param key    Object key.
   * @throws {BeamdropException} 404 if not found.
   */
  async getObject(bucket: string, key: string): Promise<GetObjectResponse> {
    return await this.rawRequest('GET', `/api/v1/buckets/${bucket}/${key}`) as GetObjectResponse;
  }

  /**
   * Delete a file.
   * @param bucket Bucket name.
   * @param key    Object key.
   * @throws {BeamdropException} 404 if not found, 423 if locked.
   */
  async deleteObject(bucket: string, key: string): Promise<true> {
    await this.request('DELETE', `/api/v1/buckets/${bucket}/${key}`);
    return true;
  }

  /**
   * Get object metadata without downloading the body.
   * @param bucket Bucket name.
   * @param key    Object key.
   * @throws {BeamdropException} 404 if not found.
   */
  async headObject(bucket: string, key: string): Promise<ObjectMetadata> {
    return await this.rawRequest('HEAD', `/api/v1/buckets/${bucket}/${key}`);
  }

  /**
   * Check whether an object exists.
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
   * List objects in a bucket with optional prefix/delimiter filtering.
   * @param bucket     Bucket name.
   * @param prefix     Only return keys starting with this prefix.
   * @param delimiter  Group keys by this character (usually '/').
   * @param maxKeys    Maximum number of results (1–1000, default 1000).
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
   * Generate a client‑side HMAC presigned URL for downloading a file.
   * The token is computed locally using the secret key; no server round‑trip.
   *
   * @param bucket     Bucket name.
   * @param key        Object key.
   * @param expiresIn  Seconds until the URL expires (e.g. 3600 = 1 hour).
   * @param method     HTTP method the URL is valid for (default: "GET").
   * @returns Full presigned URL.
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
   * Create a server‑side pretty presigned URL via the registry.
   * @param bucket       Bucket name.
   * @param key          Object key.
   * @param expiresIn    Seconds until the URL expires (null = no expiry).
   * @param maxDownloads Maximum number of downloads (null = unlimited).
   * @param method       HTTP method (default: "GET").
   * @throws {BeamdropException} on failure.
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
   * Revoke (delete) a server‑side pretty presigned URL.
   * @param token The presigned URL token.
   * @throws {BeamdropException} 404 if token not found.
   */
  async revokePrettyPresignedUrl(token: string): Promise<true> {
    await this.request('DELETE', `/api/v1/presign/${token}`);
    return true;
  }

  /**
   * List all server‑side pretty presigned URLs.
   */
  async listPrettyPresignedUrls(): Promise<ListPrettyPresignedUrlsResponse> {
    return this.request('GET', '/api/v1/presign');
  }

  // --------------------------------------------------------------------
  // Internal HTTP methods with request signing
  // --------------------------------------------------------------------

  /**
   * Send a request expecting a JSON response.
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
   * Send a request that returns raw content (file downloads, HEAD).
   * Returns an object with body (if not HEAD) and metadata headers.
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
   * Low‑level fetch with HMAC‑SHA256 signing and timeouts.
   * Returns status, response body (as string), and headers.
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
   * Compute HMAC‑SHA256 and return standard Base64.
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
   * Compute HMAC‑SHA256 and return URL‑safe Base64 (no padding, + → -, / → _).
   * Used for presigned URL tokens.
   */
  private async hmacSha256Base64Url(secret: string, message: string): Promise<string> {
    const base64 = await this.hmacSha256Base64(secret, message);
    return base64.replace(/\+/g, '-').replace(/\//g, '_'); // keep padding — server uses base64.URLEncoding WITH padding
  }
}