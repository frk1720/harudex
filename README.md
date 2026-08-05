# 🌸 HaruDex

HaruDex is a custom Google Drive Index built on Cloudflare Workers, tailored with a beautiful "Haru" (Spring) theme featuring pink and white glassmorphism aesthetics. 

## Features
- **Secure Access:** Password-protected index ensuring only authorized users can view your files.
- **Haru Theme:** A sleek, modern UI utilizing glassmorphism, completely responsive for desktop and mobile.
- **Bulk Actions:** Checkbox system to easily select multiple files, "Download Selected", or "Copy Selected Links".
- **Built-in Video Player:** Play `.mp4` and `.mkv` files directly in the browser via an elegant popup modal.
- **External Player Deep Linking:** Stream directly to external applications (VLC, MX Player, IINA, PotPlayer) using intent URLs, perfect for multi-track audio and subtitle support.
- **Limitless Streaming:** Proxied through Cloudflare Workers to bypass common Google Drive public sharing download limits.

## Deployment (Cloudflare Workers)

To deploy HaruDex, you need your own Google Drive API credentials.

1. Deploy the worker:
   ```bash
   npx wrangler deploy
   ```
2. Set up your secret variables securely via Wrangler (do not expose these in the codebase):
   ```bash
   npx wrangler secret put CLIENT_ID
   npx wrangler secret put CLIENT_SECRET
   npx wrangler secret put REFRESH_TOKEN
   npx wrangler secret put FOLDER_ID
   npx wrangler secret put APP_PASSWORD
   ```

Enjoy your aesthetic and powerful Google Drive Index!
