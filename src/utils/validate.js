import { ApiError } from "./api-error.js";

export function validate(schema) {
  return (req, res, next) => {
    const parsed = schema.safeParse({
      body: req.body ?? {},
      query: req.query ?? {},
      params: req.params ?? {},
    });
    if (!parsed.success) {
      const issues = parsed.error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      }));
      return next(new ApiError(400, "Check the entered details.", issues));
    }
    req.valid = parsed.data;
    return next();
  };
}
