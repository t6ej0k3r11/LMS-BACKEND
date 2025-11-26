const cloudinary = require("cloudinary").v2;
const fs = require("fs");
const path = require("path");

//configure with env data
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const uploadMediaToCloudinary = async (filePath) => {
  if (process.env.NODE_ENV !== "production") {
    console.log(
      "DEBUG: uploadMediaToCloudinary called with filePath:",
      filePath
    );
    console.log("DEBUG: File exists:", fs.existsSync(filePath));
    if (fs.existsSync(filePath)) {
      const stats = fs.statSync(filePath);
      console.log("DEBUG: File stats:", {
        size: stats.size,
        sizeMB: (stats.size / 1024 / 1024).toFixed(2),
        mtime: stats.mtime,
      });
    }
  }

  try {
    // Check if Cloudinary credentials are valid (not placeholder values and not empty)
    const isValidCloudinary =
      process.env.CLOUDINARY_API_KEY &&
      process.env.CLOUDINARY_API_SECRET &&
      process.env.CLOUDINARY_CLOUD_NAME &&
      process.env.CLOUDINARY_API_KEY !== "your_cloudinary_api_key" &&
      process.env.CLOUDINARY_API_SECRET !== "your_cloudinary_api_secret" &&
      process.env.CLOUDINARY_CLOUD_NAME !== "your_cloudinary_cloud_name";

    if (process.env.NODE_ENV !== "production") {
      console.log("DEBUG: Cloudinary credentials valid:", isValidCloudinary);
      console.log("DEBUG: Cloudinary config:", {
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
        api_key: process.env.CLOUDINARY_API_KEY ? "***" : "missing",
        api_secret: process.env.CLOUDINARY_API_SECRET ? "***" : "missing",
      });
    }

    if (!isValidCloudinary) {
      if (process.env.NODE_ENV !== "production") {
        console.log("DEBUG: Using local storage instead of Cloudinary");
      }
      // Use local storage instead
      return await uploadMediaLocally(filePath);
    }

    if (process.env.NODE_ENV !== "production") {
      console.log("DEBUG: Uploading to Cloudinary");
    }
    const result = await cloudinary.uploader.upload(filePath, {
      resource_type: "auto",
    });
    if (process.env.NODE_ENV !== "production") {
      console.log("DEBUG: Cloudinary upload result:", result);
    }

    // Cleanup temporary file after successful upload
    fs.unlinkSync(filePath);
    if (process.env.NODE_ENV !== "production") {
      console.log("DEBUG: Temporary file cleaned up");
    }

    return result;
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.error("DEBUG: Cloudinary upload error:", error.message || error);
      console.error("DEBUG: Full error object:", error);
    }
    throw new Error(
      `Cloudinary upload failed: ${error.message || "Unknown error"}`
    );
  }
};

const uploadMediaLocally = async (filePath) => {
  try {
    // Create uploads directory if it doesn't exist
    const uploadsDir = path.join(__dirname, "../uploads");
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    // Generate unique filename
    const fileName = `file_${Date.now()}_${path.basename(filePath)}`;
    const localPath = path.join(uploadsDir, fileName);

    // Copy file to local uploads directory
    fs.copyFileSync(filePath, localPath);

    // Cleanup temporary file after successful local upload
    fs.unlinkSync(filePath);

    // Use fixed port for localhost to avoid port conflicts
    const PORT = 5000;

    // Return local file info in similar format to Cloudinary
    return {
      public_id: fileName,
      secure_url: `http://localhost:${PORT}/uploads/${fileName}`,
      url: `http://localhost:${PORT}/uploads/${fileName}`,
      format: path.extname(filePath).slice(1),
      bytes: fs.statSync(localPath).size,
      width: null,
      height: null,
      local: true,
    };
  } catch (error) {
    console.error("Local upload error:", error.message || error);
    throw new Error(`Local upload failed: ${error.message || "Unknown error"}`);
  }
};

const deleteMediaFromCloudinary = async (publicId) => {
  try {
    // Check if this is a local file
    if (publicId && publicId.includes && publicId.includes("file_")) {
      // Delete local file
      const filePath = path.join(__dirname, "../uploads", publicId);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      return;
    }

    await cloudinary.uploader.destroy(publicId);
  } catch (error) {
    console.error("Cloudinary delete error:", error.message || error);
    throw new Error(
      `Failed to delete asset from Cloudinary: ${
        error.message || "Unknown error"
      }`
    );
  }
};

module.exports = { uploadMediaToCloudinary, deleteMediaFromCloudinary };
