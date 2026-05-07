# Fixing Firebase Storage Upload Errors (CORS)

The error `storage/retry-limit-exceeded` on `localhost` is usually caused by missing CORS (Cross-Origin Resource Sharing) configuration in your Firebase Storage bucket.

### Option 1: Use the Google Cloud Shell (Easiest)

1. Go to the [Google Cloud Console](https://console.cloud.google.com/).
2. Select your project (**notion-free**).
3. Click the **Activate Cloud Shell** icon in the top right.
4. Once the shell opens, create the `cors.json` file by running:
   ```bash
   echo '[{"origin": ["*"],"method": ["GET", "PUT", "POST", "DELETE", "HEAD"],"maxAgeSeconds": 3600}]' > cors.json
   ```
5. Apply the CORS settings to your bucket:
   ```bash
   gsutil cors set cors.json gs://notion-free.firebasestorage.app
   ```

### Option 2: Use your local terminal (If you have gcloud/gsutil installed)

Run this command in the root of your project:
```bash
gsutil cors set cors.json gs://notion-free.firebasestorage.app
```

---

### Why this happens?
By default, Firebase Storage blocks uploads from domains other than your own (like `localhost:3000`). This configuration tells Firebase to allow requests from any origin (`*`) during development.
