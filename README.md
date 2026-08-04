# T&R Growth LLC — Public Website

A small, static, dependency-free website for **T&R Growth LLC**, a United
States performance marketing and lead-response agency for local service
businesses. The site exists to publicly represent the business and support
standard business/compliance verification.

- **Legal business name:** T&R Growth LLC
- **Intended domain:** https://tnrgrowthagency.com
- **Contact email:** ryan@tnrgrowthagency.com
- **Region:** United States

## Pages

| File           | Page            |
| -------------- | --------------- |
| `index.html`   | Home            |
| `privacy.html` | Privacy Policy  |
| `terms.html`   | Terms of Service|
| `contact.html` | Contact         |
| `styles.css`   | Shared styles   |

## What this site does and does not do

- Plain static HTML and CSS. **No** JavaScript, build step, or dependencies.
- **No** contact forms, cookies, analytics, tracking, advertising, or external
  integrations.
- **No** SMS signup or customer texting.
- The only way to contact the business is the `mailto:` email link.

## Local preview

Because the site is plain static files, you can simply open `index.html` in a
browser. To preview it the way a web server would (recommended, so relative
links behave identically), run a local server from the project folder:

```bash
python3 -m http.server 8000
```

Then visit <http://localhost:8000> in your browser. Stop the server with
`Ctrl+C`.

Check both a desktop-width and a mobile-width window (use your browser's device
toolbar / responsive mode) to confirm the layout.

## Future deployment: GitHub Pages

This site is ready to deploy on GitHub Pages when you choose to. Nothing here
pushes, deploys, or configures DNS automatically — these are manual steps for
later.

> **Current branch state:** This repository's work lives on the review branch
> `tnr-minimal-compliance-site`; there is no `main` branch yet. After review and
> immediately before publication, rename the approved branch to `main`, then add
> the remote and push. Do not run these steps until the site has been reviewed
> and you are ready to publish.

1. Once the branch is approved, rename it to `main`:

   ```bash
   git branch -M main
   ```

2. Create a new GitHub repository, then add the remote and push `main`:

   ```bash
   git remote add origin https://github.com/<your-account>/<your-repo>.git
   git push -u origin main
   ```

3. In the repository on GitHub, open **Settings → Pages**.
4. Under **Build and deployment**, set **Source** to *Deploy from a branch*,
   choose the `main` branch and the `/ (root)` folder, then **Save**.
5. GitHub will publish the site at
   `https://<your-account>.github.io/<your-repo>/`.

### Using the custom domain (optional, later)

To serve the site at `tnrgrowthagency.com`:

1. In **Settings → Pages → Custom domain**, enter `tnrgrowthagency.com` and
   save. GitHub will add a `CNAME` file to the repository.
2. At your domain registrar / DNS provider, point the domain to GitHub Pages
   per GitHub's current DNS instructions (an `ALIAS`/`A` records for the apex
   domain and/or a `CNAME` for `www`).
3. Once DNS resolves, enable **Enforce HTTPS** in the Pages settings.

> DNS and domain changes are intentionally **not** performed by this project and
> should be done manually when you are ready.

## License / ownership

Content and branding are owned by T&R Growth LLC.
