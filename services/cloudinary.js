const cloudinary = require('cloudinary').v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

/**
 * Upload a PDF buffer to Cloudinary.
 * @param {Buffer} buffer - The PDF file buffer
 * @param {string} publicId - The desired public ID (without folder prefix)
 * @returns {Promise<{ secure_url: string, public_id: string }>}
 */
function uploadPDF(buffer, publicId) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        resource_type: 'raw',
        folder: 'pdf-flipbook',
        public_id: publicId,
        overwrite: false,
      },
      (error, result) => {
        if (error) return reject(error);
        resolve({
          secure_url: result.secure_url,
          public_id: result.public_id,
        });
      }
    );
    stream.end(buffer);
  });
}

/**
 * Delete a PDF from Cloudinary.
 * @param {string} publicId - The full Cloudinary public ID
 */
async function deletePDF(publicId) {
  return cloudinary.uploader.destroy(publicId, { resource_type: 'raw' });
}

module.exports = { uploadPDF, deletePDF };
