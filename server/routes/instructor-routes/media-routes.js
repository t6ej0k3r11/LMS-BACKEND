const express = require("express");
const multer = require("multer");
const {
  uploadMediaToCloudinary,
  deleteMediaFromCloudinary,
} = require("../../helpers/cloudinary");
const { authenticate } = require("../../middleware/auth-middleware");
const {
  checkInstructorApproved,
} = require("../../middleware/instructor-middleware");
const { validateBulkFiles, createFileFilter, createLimits } = require("../../middleware/fileValidation");

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authenticate);
// Apply instructor approval check to all routes (requires approved instructor)
router.use(checkInstructorApproved);

// Configure multer for media uploads (allows all file types)
const upload = multer({
  dest: "uploads/",
  fileFilter: createFileFilter(['image', 'video', 'document', 'zip']),
  limits: createLimits(['image', 'video', 'document', 'zip'])
});

const bulkUpload = multer({
  dest: "uploads/",
  fileFilter: createFileFilter(['image', 'video', 'document', 'zip']),
  limits: createLimits(['image', 'video', 'document', 'zip'])
});

router.post("/upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No file provided",
      });
    }

    const result = await uploadMediaToCloudinary(req.file.path);

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (e) {
    console.error("Upload error:", e.message || e);
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

router.post("/bulk-upload", bulkUpload.array("files", 10), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No files provided",
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
