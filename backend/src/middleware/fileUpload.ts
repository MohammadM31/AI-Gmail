// backend/src/middleware/fileUpload.ts
import { Request, Response, NextFunction } from "express";
import { ApiError, ValidationError } from "./errorHandler";
import { 
  isValidFileType, 
  isValidFileSize, 
  sanitizeFilename,
  allowedMimeTypes 
} from "../utils/sanitize";
import { logger } from "../utils/logger";

interface FileValidationOptions {
  maxSize?: number;
  allowedTypes?: string[];
  maxFiles?: number;
  maxTotalSize?: number;
}

const DEFAULT_OPTIONS: FileValidationOptions = {
  maxSize: 10 * 1024 * 1024, // 10MB
  allowedTypes: allowedMimeTypes,
  maxFiles: 10,
  maxTotalSize: 50 * 1024 * 1024, // 50MB
};

// Validate a single file
export function validateFile(
  file: {
    name: string;
    size: number;
    type: string;
    path?: string;
  },
  options: FileValidationOptions = {}
): { valid: boolean; error?: string } {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  
  // Check file size
  if (!isValidFileSize(file.size)) {
    return { valid: false, error: `File "${file.name}" exceeds maximum size (${opts.maxSize} bytes)` };
  }
  
  // Check file type
  if (opts.allowedTypes && !isValidFileType(file.type)) {
    return { valid: false, error: `File type "${file.type}" is not allowed` };
  }
  
  // Sanitize filename
  const sanitizedName = sanitizeFilename(file.name);
  if (sanitizedName !== file.name) {
    logger.warn({ original: file.name, sanitized: sanitizedName }, "Filename sanitized");
  }
  
  return { valid: true };
}

// Middleware for validating uploaded files
export function validateFileUpload(options: FileValidationOptions = {}) {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  
  return (req: Request, _res: Response, next: NextFunction) => {
    try {
      // Check if there are files in the request
      const files = (req as any).files || (req.body as any).files || [];
      
      if (!files || files.length === 0) {
        return next();
      }
      
      // Check max number of files
      if (files.length > (opts.maxFiles || 10)) {
        throw new ValidationError(`Maximum ${opts.maxFiles} files allowed`);
      }
      
      // Check total size
      const totalSize = files.reduce((sum: number, file: any) => sum + (file.size || 0), 0);
      if (totalSize > (opts.maxTotalSize || 50 * 1024 * 1024)) {
        throw new ValidationError(`Total file size exceeds ${opts.maxTotalSize} bytes`);
      }
      
      // Validate each file
      const errors: string[] = [];
      files.forEach((file: any, index: number) => {
        const result = validateFile(file, opts);
        if (!result.valid && result.error) {
          errors.push(`File ${index + 1}: ${result.error}`);
        }
        
        // Sanitize filename
        if (file.name) {
          file.name = sanitizeFilename(file.name);
        }
      });
      
      if (errors.length > 0) {
        throw new ValidationError(errors.join("; "));
      }
      
      next();
    } catch (error) {
      next(error);
    }
  };
}

// Specific validators for different upload scenarios
export const validateEmailAttachments = validateFileUpload({
  maxSize: 10 * 1024 * 1024, // 10MB per file
  maxFiles: 10,
  maxTotalSize: 25 * 1024 * 1024, // 25MB total
});

export const validateProfilePicture = validateFileUpload({
  maxSize: 2 * 1024 * 1024, // 2MB
  maxFiles: 1,
  allowedTypes: ["image/jpeg", "image/png", "image/webp"],
});

export const validateDocumentUpload = validateFileUpload({
  maxSize: 20 * 1024 * 1024, // 20MB per file
  maxFiles: 5,
  maxTotalSize: 50 * 1024 * 1024, // 50MB total
});

// Middleware to scan for malware (placeholder - integrate with ClamAV or similar)
export function scanForMalware(req: Request, _res: Response, next: NextFunction) {
  // In production, this would integrate with a virus scanner
  // For now, we'll log that we would scan
  
  const files = (req as any).files || (req.body as any).files || [];
  if (files && files.length > 0) {
    logger.info({ fileCount: files.length }, "Would scan files for malware");
  }
  
  next();
}