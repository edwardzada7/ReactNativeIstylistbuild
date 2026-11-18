# Store submission checklist

Work through this top to bottom. Items marked **(you)** can't be done from code.

## 1. One-time backend setup

1. **Run `backend/supabase/user_blocks.sql`** in the Supabase SQL editor. Without it, "Block user" shows an error and nothing is hidden. It is safe to run twice.
2. Confirm which server the app talks to. `EXPO_PUBLIC_API_BASE_URL` must point at a backend that is **running** (an older note says the Railway project was paused). The block check and the stricter account deletion in `backend/server.py` only apply if that server runs this repo's `backend/`.
3. Paystack: confirm the backend uses **live** keys before store review.

## 2. EAS environment variables **(you)**

`.env` is not in Git, so set these on Expo for both environments (repeat for each name):

```
cd frontend
npx eas-cli login
npx eas-cli env:create --name EXPO_PUBLIC_API_BASE_URL --value "<backend url>/api" --environment preview --visibility plaintext
npx eas-cli env:create --name EXPO_PUBLIC_SUPABASE_URL --value "<supabase url>" --environment preview --visibility plaintext
npx eas-cli env:create --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value "<anon key>" --environment preview --visibility plaintext
# then the same three with --environment production
```

Never put the Supabase **service role** key or the Paystack secret key in the app.

## 3. Preview builds, then test

```
npx eas-cli build --profile preview --platform android   # installable .apk
npx eas-cli build --profile preview --platform ios       # needs a paid Apple account + registered iPhones (eas device:create)
```

Test on real devices, as a customer **and** a provider:

- [ ] Sign up (terms and privacy links open), log in, log out
- [ ] Book a service, pay, see the booking, rebook with provider time slots
- [ ] Provider: staff schedule, availability, certificate submission, withdrawal, service invoice
- [ ] Feed: post, like, comment, **report a post**, **block the poster** (their posts disappear)
- [ ] Chat: **report user**, **block user** (conversation disappears, composer locked), unblock in Settings > Blocked Users
- [ ] Delete account on an account that has bookings and wallet history, then try to log in again (must fail)
- [ ] Notifications, location, camera and photo picking all ask for permission and work

## 4. Production builds and submission

```
npx eas-cli build --profile production --platform all
npx eas-cli submit --platform android
npx eas-cli submit --platform ios
```

EAS manages the Android signing key. Let it create one on the first production build and **download a backup** (`npx eas-cli credentials`).

## 5. Store forms **(you)**

- Public **privacy policy URL** (the in-app page is not enough)
- Apple: App Privacy labels, age rating, screenshots, support URL, review notes (below)
- Google Play: Data safety form, **Financial features** declaration (wallet withdrawals), content rating, target audience, screenshots
- Declare data collected: name, email, phone, precise and approximate location, photos, microphone (voice messages), user content (posts, comments, chat), payment/financial info, purchases
- Personal Google Play accounts created after 13 Nov 2023 need a closed test with 12+ testers for 14 days before production access

### Review notes template

```
iStylist connects customers with beauty service providers. Sign-in is required.

Demo customer:  <email> / <password>
Demo provider:  <email> / <password>

Payments: the wallet and shop checkout pay for real-world services and physical
products consumed outside the app (Guideline 3.1.3(e)); no digital goods are sold.

User-generated content: posts are moderated before they appear; users can report
posts and users, and block any user (Settings > Blocked Users). Abusive content is
removed and accounts can be suspended. Contact: <support email>.

Account deletion: Settings > Delete Account.
```
