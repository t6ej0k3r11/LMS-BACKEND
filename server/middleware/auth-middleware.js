const jwt = require("jsonwebtoken");

const verifyToken = (token, secretKey) => {
  return jwt.verify(token, secretKey);
};

const authenticate = (req, res, next) => {
  console.log("authenticate: Incoming request to", req.path);
  const authHeader = req.headers.authorization;
  console.log("authenticate: authHeader =", authHeader);

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    console.log("authenticate: Authorization header missing or invalid");
    return res.status(401).json({
      success: false,
      message: "Authorization header missing or invalid",
    });
  }

  const token = authHeader.split(" ")[1];
  console.log("authenticate: token =", token ? "present" : "missing");

  if (!token) {
    console.log("authenticate: Access token is required");
    return res.status(401).json({
      success: false,
      message: "Access token is required",
    });
  }

  try {
    const payload = verifyToken(token, process.env.JWT_SECRET);
    console.log("authenticate: payload =", {
      _id: payload._id,
      role: payload.role,
      email: payload.email,
    });

    // Check if token is expired
    const currentTime = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < currentTime) {
      console.log("authenticate: Access token has expired");
      return res.status(401).json({
        success: false,
        message: "Access token has expired",
      });
    }

    req.user = payload;
    console.log("authenticate: Authentication successful, proceeding");
    next();
  } catch (error) {
    console.log(
      "authenticate: Invalid or expired token, error =",
      error.message
    );
    return res.status(401).json({
      success: false,
      message: "Invalid or expired token",
    });
  }
};

// Authorization middleware for role-based access
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: "Insufficient permissions",
      });
    }
    next();
  };
};

// Middleware to check if user owns the resource or is admin
const authorizeOwnerOrAdmin = (Model, options = {}) => {
  const { ownershipField = "createdBy" } = options;

  return async (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const resourceId = req.params.id;
    if (!resourceId) {
      return res.status(400).json({
        success: false,
        message: "Resource ID is required",
      });
    }

    try {
      const resource = await Model.findById(resourceId);
      if (!resource) {
        return res.status(404).json({
          success: false,
          message: "Resource not found",
        });
      }

      // Admin has full access
      if (req.user.role === "admin") {
        return next();
      }

      // Check if user is the owner
      const ownerId = resource[ownershipField];
      if (ownerId && ownerId.toString() === req.user._id.toString()) {
        return next();
      }

      // Deny access for non-owners and non-admins
      return res.status(403).json({
        success: false,
        message: "Access denied",
      });
    } catch (error) {
      console.error("Error in authorizeOwnerOrAdmin middleware:", error);
      return res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  };
};

module.exports = {
  authenticate,
  authorize,
  authorizeOwnerOrAdmin,
};
