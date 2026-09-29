import { ApiError } from "../utils/api-error.js";
import { asyncHandler } from "../utils/async-handler.js";
import { verifyAccessToken } from "../utils/tokens.js";
import { userRepo } from "../modules/users/user.repo.js";

async function loadUser(req) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) return null;
  let payload;
  try {
    payload = verifyAccessToken(token);
  } catch {
    throw new ApiError(401, "Sign in required.");
  }
  const user = await userRepo.findAuthById(payload.sub);
  if (!user || user.status !== "active") throw new ApiError(401, "Sign in required.");
  return user;
}

export const authenticate = asyncHandler(async (req, res, next) => {
  const user = await loadUser(req);
  if (!user) throw new ApiError(401, "Sign in required.");
  req.user = user;
  next();
});

export const optionalAuthenticate = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization || "";
  if (!header) {
    next();
    return;
  }
  const user = await loadUser(req);
  if (user) req.user = user;
  next();
});
