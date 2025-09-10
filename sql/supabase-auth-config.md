# Supabase Auth Configuration Checklist

## CRITICAL: Fix These Settings in Supabase Dashboard

### 1. Authentication > URL Configuration
Go to: https://app.supabase.com/project/nslcadgicgkncajoyyno/auth/url-configuration

**Set these EXACTLY:**
- **Site URL**: `https://job-scraper-liard.vercel.app`
- **Redirect URLs** (Add ALL of these):
  ```
  https://job-scraper-liard.vercel.app/auth/callback
  http://localhost:3000/auth/callback
  http://localhost:4001/auth/callback
  ```

### 2. Authentication > Providers > Google
Go to: https://app.supabase.com/project/nslcadgicgkncajoyyno/auth/providers

**Configure Google Provider:**
1. Toggle **Enable Sign in with Google** to ON
2. Enter credentials from `.env.credentials`:
   - Client ID (from your file)
   - Client Secret (from your file)
3. **Authorized Client IDs**: Leave empty
4. **Skip nonce checks**: Leave unchecked
5. Click **Save**

### 3. Google Cloud Console Settings
Go to: https://console.cloud.google.com/apis/credentials

**Update your OAuth 2.0 Client:**

**Authorized JavaScript origins:**
```
https://job-scraper-liard.vercel.app
https://nslcadgicgkncajoyyno.supabase.co
http://localhost:3000
http://localhost:4001
```

**Authorized redirect URIs:**
```
https://nslcadgicgkncajoyyno.supabase.co/auth/v1/callback
https://job-scraper-liard.vercel.app/auth/callback
http://localhost:3000/auth/callback
http://localhost:4001/auth/callback
```

### 4. Database Settings
Go to: https://app.supabase.com/project/nslcadgicgkncajoyyno/settings/database

**Ensure these are set:**
- **Connection Pooling**: Enabled
- **SSL Enforcement**: Enabled

## Verification Steps

1. **Check Site URL is correct:**
   - Must be `https://job-scraper-liard.vercel.app`
   - NOT `https://nslcadgicgkncajoyyno.supabase.co/job-scraper-liard.vercel.app`

2. **Test redirect flow:**
   - The OAuth flow should go: Your App → Google → Supabase → Your App
   - The final redirect should be to YOUR domain, not Supabase's

3. **Verify callback URL format:**
   - Should be: `https://job-scraper-liard.vercel.app/auth/callback`
   - NOT: `https://nslcadgicgkncajoyyno.supabase.co/job-scraper-liard.vercel.app`

## Common Issues

### Wrong Redirect URL Pattern
❌ WRONG: `https://nslcadgicgkncajoyyno.supabase.co/job-scraper-liard.vercel.app`
✅ RIGHT: `https://job-scraper-liard.vercel.app`

### Missing Redirect URLs
Make sure you have ALL redirect URLs added, not just one.

### Mismatched Origins
Google Console origins must match exactly with what your app uses.

## After Configuration

1. Clear browser cache and cookies
2. Try signing in again
3. Check `auth_debug_log` table for any errors:
   ```sql
   SELECT * FROM auth_debug_log ORDER BY event_time DESC;
   ```