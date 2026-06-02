import { Beamdrop, BeamdropException } from "../src/index";

describe("beamdrop client", () => {
  const config = {
    baseUrl: "https://files.example.com",
    accessKey: "BDK_test_access_key",
    secretKey: "sk_test_secret_key",
  };

  it("exports Beamdrop and BeamdropException", () => {
    expect(typeof Beamdrop).toBe("function");
    expect(typeof BeamdropException).toBe("function");
  });

  it("constructs a client with expected public methods", () => {
    const client = new Beamdrop(config) as any;

    [
      "createBucket",
      "createBucketIfNotExists",
      "deleteBucket",
      "listBuckets",
      "bucketExists",
      "putObject",
      "getObject",
      "deleteObject",
      "headObject",
      "objectExists",
      "listObjects",
      "presignedUrl",
      "createPrettyPresignedUrl",
      "revokePrettyPresignedUrl",
      "listPrettyPresignedUrls",
    ].forEach((methodName) => {
      expect(typeof client[methodName]).toBe("function");
    });
  });

  it("builds client-side presigned URL with expected query params", async () => {
    const client = new Beamdrop(config) as any;
    const hmacMock = jest.fn().mockResolvedValue("signed-token-value");

    client.hmacSha256Base64Url = hmacMock;

    const url = await client.presignedUrl("docs", "report.pdf", 3600);
    const parsed = new URL(url);

    expect(parsed.origin).toBe("https://files.example.com");
    expect(parsed.pathname).toBe("/api/v1/buckets/docs/report.pdf");
    expect(parsed.searchParams.get("token")).toBe("signed-token-value");
    expect(parsed.searchParams.get("access_key")).toBe("BDK_test_access_key");
    expect(parsed.searchParams.get("expires")).toMatch(/Z$/);

    expect(hmacMock).toHaveBeenCalledWith(
      "sk_test_secret_key",
      expect.stringMatching(/^GET\ndocs\nreport\.pdf\n\d+$/),
    );
  });

  it("createPrettyPresignedUrl sends camelCase payload fields", async () => {
    const client = new Beamdrop(config) as any;
    const requestMock = jest.fn().mockResolvedValue({ token: "abc123" });

    client.request = requestMock;

    await client.createPrettyPresignedUrl("docs", "report.pdf", 86400, 10);

    expect(requestMock).toHaveBeenCalledWith(
      "POST",
      "/api/v1/presign",
      JSON.stringify({
        bucket: "docs",
        key: "report.pdf",
        method: "GET",
        expiresIn: 86400,
        maxDownloads: 10,
      }),
    );
  });

  it("BeamdropException stores status and body", () => {
    const body = { error: { code: "OBJECT_NOT_FOUND" } };
    const err = new BeamdropException("Object not found", 404, body);

    expect(err.name).toBe("BeamdropException");
    expect(err.message).toBe("Object not found");
    expect(err.status).toBe(404);
    expect(err.body).toEqual(body);
  });
});
