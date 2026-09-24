# 📖 PDF Flipbook

Upload a PDF and display it as a beautiful animated flipbook with realistic page-flip animation.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Node.js + Express.js |
| Frontend | HTML, CSS, Vanilla JavaScript |
| PDF Rendering | [PDF.js](https://mozilla.github.io/pdf.js/) |
| Page Flip | [StPageFlip](https://nodlik.github.io/StPageFlip/) |
| Database | [Turso](https://turso.tech/) (libSQL) |
| File Storage | [Cloudinary](https://cloudinary.com/) |
| Deployment | [Vercel](https://vercel.com/) |

## How It Works

1. User uploads a PDF with a title
2. PDF is stored in **Cloudinary** (raw file)
3. Book metadata (title, slug, PDF URL) is saved in **Turso**
4. A unique public URL is generated (e.g., `/book/pengantar-kebugaran-a81f32`)
5. When the URL is opened, the browser:
   - Loads the PDF from Cloudinary using **PDF.js**
   - Renders each page to a canvas
   - Displays them as an interactive flipbook with **StPageFlip**

## Setup

### 1. Cloudinary Setup

1. Create a free [Cloudinary](https://cloudinary.com/) account
2. Go to **Dashboard** → copy your **Cloud Name**, **API Key**, and **API Secret**

### 2. Turso Setup

1. Install the [Turso CLI](https://docs.turso.tech/cli/installation):
   ```bash
   curl -sSfL https://get.tur.so/install.sh | bash
   ```
2. Sign up and create a database:
   ```bash
   turso auth signup
   turso db create pdf-flipbook
   ```
3. Get the database URL and auth token:
   ```bash
   turso db show pdf-flipbook --url
   turso db tokens create pdf-flipbook
   ```

### 3. Environment Variables

Copy `.env.example` to `.env` and fill in your credentials:

```bash
cp .env.example .env
```

```env
TURSO_DATABASE_URL=libsql://your-db-name-your-org.turso.io
TURSO_AUTH_TOKEN=your-auth-token

CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret

MAX_FILE_SIZE_MB=50
```

### 4. Install Dependencies

```bash
npm install
```

### 5. Run Locally

```bash
npm run dev
```

The app will be available at `http://localhost:3000`.

The `books` table is created automatically on first startup.

## Usage

### Upload a PDF

1. Open `http://localhost:3000`
2. Enter a book title
3. Select a PDF file
4. Click **Generate Flipbook**
5. You'll be redirected to the flipbook viewer

### View a Flipbook

- **Desktop**: Two-page spread with mouse drag or click navigation
- **Mobile**: Single-page view with touch swipe
- **Controls**: Previous / Next buttons, page counter, fullscreen, download

### Manage Books

- Visit `/books` to see all uploaded books
- Click **Open** to view a flipbook
- Click **Delete** to remove a book (deletes from both Cloudinary and Turso)

## Vercel Deployment

1. Push your code to a Git repository (GitHub, GitLab, etc.)

2. Import the project on [Vercel](https://vercel.com/new)

3. Add the environment variables in Vercel's project settings:
   - `TURSO_DATABASE_URL`
   - `TURSO_AUTH_TOKEN`
   - `CLOUDINARY_CLOUD_NAME`
   - `CLOUDINARY_API_KEY`
   - `CLOUDINARY_API_SECRET`
   - `MAX_FILE_SIZE_MB`

4. Deploy

The `vercel.json` file routes all requests through the Express server.

## Project Structure

```
pdf-flipbook/
├── server.js              # Express entry point
├── package.json
├── vercel.json             # Vercel configuration
├── .env.example            # Environment variable template
├── .gitignore
├── README.md
├── db/
│   └── turso.js            # Turso/libSQL database client
├── services/
│   └── cloudinary.js       # Cloudinary upload/delete service
├── routes/
│   ├── api.js              # POST /api/books, DELETE /api/books/:id
│   └── books.js            # GET /book/:slug, GET /books
└── public/
    ├── index.html           # Upload page
    ├── books.html           # Books list page
    ├── viewer.html          # Flipbook viewer page
    ├── css/
    │   └── style.css        # Global styles
    └── js/
        ├── upload.js        # Upload form logic
        ├── books.js         # Books list logic
        └── viewer.js        # PDF.js + StPageFlip integration
```

## License

MIT
