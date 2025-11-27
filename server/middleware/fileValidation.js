// Centralized file validation middleware for LMS
// Implements enterprise-grade file type and size validation

const FILE_TYPES = {
  IMAGE: {
    allowedTypes: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'],
    maxSize: 5 * 1024 * 1024, // 5MB
    name: 'image'
  },
  VIDEO: {
    allowedTypes: ['video/mp4', 'video/mpeg', 'video/quicktime'],
    maxSize: 500 * 1024 * 1024, // 500MB
    name: 'video'
  },
  DOCUMENT: {
    allowedTypes: [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ],
    maxSize: 20 * 1024 * 1024, // 20MB
    name: 'document'
  },
  ZIP: {
    allowedTypes: ['application/zip', 'application/x-zip-compressed'],
    maxSize: 50 * 1024 * 1024, // 50MB
    name: 'zip'
  }
};

// Helper function to validate single file
const validateFile = (file, typeConfig) => {
  if (!file) {
    return { valid: false, message: 'No file provided' };
  }

  // Check file type
  if (!typeConfig.allowedTypes.includes(file.mimetype)) {
    return {
      valid: false,
      message: `Invalid file format. Allowed formats: ${typeConfig.allowedTypes.join(', ')}`
    };
  }

  // Check file size
  if (file.size > typeConfig.maxSize) {
    const maxSizeMB = typeConfig.maxSize / (1024 * 1024);
    return {
      valid: false,
      message: `File too large. Max allowed size for ${typeConfig.name} is ${maxSizeMB} MB.`
    };
  }

  return { valid: true };
};

// Validation middleware functions
const validateImage = (req, res, next) => {
  if (!req.file) {
    return res.status(400).json({
      success: false,
      message: 'No image file provided'
    });
  }

  const result = validateFile(req.file, FILE_TYPES.IMAGE);
  if (!result.valid) {
    return res.status(400).json({
      success: false,
      message: result.message
    });
  }

  next();
};

const validateVideo = (req, res, next) => {
  if (!req.file) {
    return res.status(400).json({
      success: false,
      message: 'No video file provided'
    });
  }

  const result = validateFile(req.file, FILE_TYPES.VIDEO);
  if (!result.valid) {
    return res.status(400).json({
      success: false,
      message: result.message
    });
  }

  next();
};

const validateDocument = (req, res, next) => {
  if (!req.file) {
    return res.status(400).json({
      success: false,
      message: 'No document file provided'
    });
  }

  const result = validateFile(req.file, FILE_TYPES.DOCUMENT);
  if (!result.valid) {
    return res.status(400).json({
      success: false,
      message: result.message
    });
  }

  next();
};

const validateZip = (req, res, next) => {
  if (!req.file) {
    return res.status(400).json({
      success: false,
      message: 'No zip file provided'
    });
  }

  const result = validateFile(req.file, FILE_TYPES.ZIP);
  if (!result.valid) {
    return res.status(400).json({
      success: false,
      message: result.message
    });
  }

  next();
};

// Bulk validation for multiple files
const validateBulkFiles = (files, allowedTypes) => {
  const errors = [];
  const validFiles = [];

  files.forEach((file, index) => {
    let typeConfig = null;

    // Determine file type based on mimetype
    if (FILE_TYPES.IMAGE.allowedTypes.includes(file.mimetype)) {
      typeConfig = FILE_TYPES.IMAGE;
    } else if (FILE_TYPES.VIDEO.allowedTypes.includes(file.mimetype)) {
      typeConfig = FILE_TYPES.VIDEO;
    } else if (FILE_TYPES.DOCUMENT.allowedTypes.includes(file.mimetype)) {
      typeConfig = FILE_TYPES.DOCUMENT;
    } else if (FILE_TYPES.ZIP.allowedTypes.includes(file.mimetype)) {
      typeConfig = FILE_TYPES.ZIP;
    }

    if (!typeConfig) {
      errors.push({
        index,
        filename: file.originalname,
        message: `Invalid file type: ${file.mimetype}`
      });
      return;
    }

    // Check if this type is allowed for this endpoint
    if (allowedTypes && !allowedTypes.includes(typeConfig.name)) {
      errors.push({
        index,
        filename: file.originalname,
        message: `File type not allowed for this upload: ${typeConfig.name}`
      });
      return;
    }

    const result = validateFile(file, typeConfig);
    if (!result.valid) {
      errors.push({
        index,
        filename: file.originalname,
        message: result.message
      });
    } else {
      validFiles.push(file);
    }
  });

  return { validFiles, errors };
};

// Multer file filter functions
const createFileFilter = (allowedTypes) => {
  return (req, file, cb) => {
    // Check if file type is in allowed types
    const allAllowedTypes = allowedTypes.flatMap(type => FILE_TYPES[type.toUpperCase()].allowedTypes);

    if (allAllowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Invalid file type. Allowed: ${allAllowedTypes.join(', ')}`), false);
    }
  };
};

// Multer limits configuration
const createLimits = (allowedTypes) => {
  // Find the maximum size among allowed types
  const maxSize = Math.max(...allowedTypes.map(type => FILE_TYPES[type.toUpperCase()].maxSize));
  return {
    fileSize: maxSize,
    files: 10 // Default max files for bulk upload
  };
};

module.exports = {
  validateImage,
  validateVideo,
  validateDocument,
  validateZip,
  validateBulkFiles,
  createFileFilter,
  createLimits,
  FILE_TYPES
};