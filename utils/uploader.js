// ./utils/uploader.js
const axios = require('axios');
const FormData = require('form-data');

/**
 * Upload une image sur Catbox
 * @param {Buffer} buffer - Le buffer de l'image
 * @param {string} type - Le type de fichier (image/png, image/jpeg, etc.)
 * @returns {Promise<string>} - L'URL de l'image uploadée
 */
async function uploadToCatbox(buffer, type = 'image/png') {
    const form = new FormData();
    form.append('reqtype', 'fileupload');
    form.append('fileToUpload', buffer, {
        filename: 'upload.png',
        contentType: type,
    });

    const response = await axios.post('https://catbox.moe/user/api.php', form, {
        headers: form.getHeaders(),
        timeout: 30000,
    });

    const url = response.data.trim();
    if (!url.startsWith('http')) {
        throw new Error('Upload failed');
    }
    return url;
}

module.exports = {
    uploadToCatbox,
};
