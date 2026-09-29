import { ApiError } from "../utils/api-error.js";

export function notFound(req, res, next) {
  next(new ApiError(404, "Not found."));
}

export function errorHandler(err, req, res, next) {
  const status = err.status || 500;
  const message = status === 500 ? "Something went wrong." : err.message;
  const body = { message };
  if (err.details) body.details = err.details;
  if (status === 500) {
    console.error(err);
  }
  res.status(status).json(body);
}
