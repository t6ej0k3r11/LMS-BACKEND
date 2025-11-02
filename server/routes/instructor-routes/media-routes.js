const express = require("express");
const multer = require("multer");
const {
  uploadMediaToCloudinary,
  deleteMediaFromCloudinary,
} = require("../../helpers/cloudinary");
const authenticate = require("../../middleware/auth-middleware");

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authenticate.authenticate);

const upload = multer({ dest: "uploads/" });

router.post("/upload", upload.single("file"), async (req, res) => {
  console.log("DEBUG: /media/upload endpoint called");
  console.log("DEBUG: Request file details:", {
    filename: req.file?.filename,
    originalname: req.file?.originalname,
    mimetype: req.file?.mimetype,
    size: req.file?.size,
    sizeMB: req.file ? (req.file.size / 1024 / 1024).toFixed(2) : null,
    path: req.file?.path,
  });
  console.log("DEBUG: Request headers:", req.headers);
  console.log("DEBUG: Request body:", req.body);

  try {
    // Validate file
    if (!req.file) {
      console.log("DEBUG: No file provided in request");
      return res.status(400).json({
        success: false,
        message: "No file provided",
      });
    }

    // File type validation
    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/gif",
      "image/webp",
      "video/mp4",
      "video/avi",
      "video/mov",
      "application/pdf",
    ];
    console.log(
      "DEBUG: Server-side validation - allowedTypes:",
      allowedTypes,
      "fileType:",
      req.file.mimetype
    );
    if (!allowedTypes.includes(req.file.mimetype)) {
      console.log("DEBUG: File type validation failed on server");
      return res.status(400).json({
        success: false,
        message:
          "Invalid file type. Allowed types: JPEG, PNG, GIF, WebP, MP4, AVI, MOV, PDF",
      });
    }

    // File size validation (10MB limit)
    const maxSize = 10 * 1024 * 1024; // 10MB in bytes
    console.log(
      "DEBUG: Server-side validation - maxSize:",
      maxSize,
      "fileSize:",
      req.file.size
    );
    if (req.file.size > maxSize) {
      console.log("DEBUG: File size validation failed on server");
      return res.status(400).json({
        success: false,
        message: "File too large. Maximum size allowed is 10MB",
      });
    }

    console.log("DEBUG: Calling uploadMediaToCloudinary");
    const result = await uploadMediaToCloudinary(req.file.path);
    console.log("DEBUG: uploadMediaToCloudinary result:", result);

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (e) {
    console.error("DEBUG: Upload error:", e.message || e);
    console.error("DEBUG: Full error object:", e);
    res.status(500).json({
      success: false,
      message: e.message || "Error uploading file",
    });
  }
});

router.delete("/delete/:id", async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Asset Id is required",
      });
    }

    await deleteMediaFromCloudinary(id);

    res.status(200).json({
      success: true,
      message: "Asset deleted successfully",
    });
  } catch (e) {
    console.error("Delete error:", e.message || e);
    res.status(500).json({
      success: false,
      message: e.message || "Error deleting file",
    });
  }
});

router.post("/bulk-upload", upload.array("files", 10), async (req, res) => {
  try {
    // Validate files
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No files provided",
      });
    }

    // File validation for each file
    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/gif",
      "image/webp",
      "video/mp4",
      "video/avi",
      "video/mov",
      "application/pdf",
    ];
    const maxSize = 10 * 1024 * 1024; // 10MB in bytes

    const validationErrors = [];
    req.files.forEach((file, index) => {
      if (!allowedTypes.includes(file.mimetype)) {
        validationErrors.push(
          `File ${index + 1}: Invalid type (${file.mimetype})`
        );
      }
      if (file.size > maxSize) {
        validationErrors.push(
          `File ${index + 1}: Too large (${(file.size / 1024 / 1024).toFixed(
            2
          )}MB)`
        );
      }
    });

    if (validationErrors.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: validationErrors,
      });
    }

    // Upload files with partial failure handling
    const uploadPromises = req.files.map(async (fileItem, index) => {
      try {
        const result = await uploadMediaToCloudinary(fileItem.path);
        return { success: true, index, data: result };
      } catch (error) {
        console.error(
          `Upload failed for file ${index + 1}:`,
          error.message || error
        );
        return {
          success: false,
          index,
          error: error.message || "Upload failed",
        };
      }
    });

    const results = await Promise.allSettled(uploadPromises);

    const successful = results
      .filter((r) => r.status === "fulfilled" && r.value.success)
      .map((r) => r.value);
    const failed = results
      .filter((r) => r.status === "rejected" || !r.value.success)
      .map((r) => ({
        index: r.status === "rejected" ? "unknown" : r.value.index,
        error: r.status === "rejected" ? r.reason.message : r.value.error,
      }));

    if (successful.length === 0) {
      return res.status(500).json({
        success: false,
        message: "All uploads failed",
        errors: failed,
      });
    }

    res.status(200).json({
      success: true,
      message:
        successful.length === req.files.length
          ? "All files uploaded successfully"
          : `${successful.length} of ${req.files.length} files uploaded successfully`,
      data: successful.map((s) => s.data),
      ...(failed.length > 0 && { errors: failed }),
    });
  } catch (event) {
    console.error("Bulk upload error:", event.message || event);
    res.status(500).json({
      success: false,
      message: event.message || "Error in bulk uploading files",
    });
  }
});

module.exports = router;
