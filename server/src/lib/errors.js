// A small error type so route handlers can do: throw new HttpError(404, "Request not found")
export class HttpError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

// Validates req.body (or any object) against a zod schema.
// Throws a 400 with a readable list of problems if it doesn't match.
export function validate(schema, data) {
  const result = schema.safeParse(data);
  if (!result.success) {
    const details = result.error.issues.map((i) => ({
      field: i.path.join(".") || "(body)",
      message: i.message,
    }));
    throw new HttpError(400, "Some fields are missing or invalid", details);
  }
  return result.data;
}

// Last middleware in the chain: turns any thrown error into a JSON response.
export function errorHandler(err, _req, res, _next) {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: err.message, details: err.details });
  }
  if (err.type === "entity.parse.failed") {
    return res.status(400).json({ error: "Request body is not valid JSON" });
  }
  console.error(err);
  res.status(500).json({ error: "Something went wrong on the server" });
}
