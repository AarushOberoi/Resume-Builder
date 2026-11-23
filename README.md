# 📄 Resume Builder

A browser-based resume editor that produces clean, **LaTeX-style one-page resumes** with a live preview and one-click **PDF download**. It's built for students and early-career applicants who need a tightly formatted resume.

🔗 **Try it:** https://resumebuilder.aarushoberoi.workers.dev

---

## ✨ Features

- **Live preview** that updates as you type, with page count and "last page % full" shown
- **Page limit control:** 1, 2 or 3 pages
- **Line-fit guidance** on every bullet: recommended vs current character count, characters remaining, and an "over" warning when a bullet would spill onto a second line
- **Bullet rules:** target 1 or up to 2 lines per bullet, with a max of 3 to 6 bullets per entry or no limit
- **Four content types per section**
  - **Entries:** title, date, extra detail, slanted sub-line and bullet points
  - **Bullet list:** a plain list of bullet points
  - **Two-column table:** label | value rows, ideal for skills
  - **Paragraph:** a short block of text
- **Ready-made sections:** Education, Professional Experience, Internships, Research Experience, Key Projects, Positions of Responsibility, Publications, Certifications, Achievements, Extracurricular Activities, Technical Skills and Summary, plus **custom sections**
- **Page & header settings**
  - Optional reserved blank space for a pre-printed institute or placement-office header (default 53.09 mm)
  - Optional name and contact header with adjustable reserved height
  - Bottom margin and page 2+ top margin
  - Heading colour (default RoyalBlue)
  - Margin guides in the preview (never printed)
- **Inline formatting:** bold, italic, arrows, dashes and section helpers in the toolbar
- **`.tex` and Layout views** to switch between the LaTeX source and the page layout
- **Zoom controls:** Fit, 50% to 200%
- **Download PDF** in one click
- **No sign-up and no backend:** everything runs in your browser

## 🧭 How to Use

1. Open the [live site](https://resumebuilder.aarushoberoi.workers.dev).
2. Open **Page & header** to set your page limit, margins and header options.
3. Fill in each section. Use **Add entry**, **Add bullet** and **Add section** as needed.
4. Keep an eye on the per-bullet counters so every bullet fits cleanly on its line.
5. Check the preview, then click **Download PDF**.

> 💡 **Tip:** The site loads with sample content (a fictional data science resume) so you can see how each section type behaves. Replace it with your own details.

## 🗂️ Project Structure

```
Resume-Builder/
├── index.html   # App shell
├── css/         # Stylesheets
├── js/          # Editor logic, layout and PDF generation
├── fonts/       # Font files used for accurate resume rendering
├── vendor/      # Third-party libraries
├── download     # (see note below)
└── README.md
```

## 🚀 Run Locally

No build tools needed. Clone the repo and serve the folder with any static server:

```bash
git clone https://github.com/AarushOberoi/Resume-Builder.git
cd Resume-Builder

# Option 1: Python
python -m http.server 8000

# Option 2: Node
npx serve .
```

Then open `http://localhost:8000`.

## ☁️ Deployment

Deployed as static assets on **Cloudflare Workers**:

```bash
npx wrangler deploy
```

## 🛠️ Built With

- HTML / CSS / JavaScript
- Cloudflare Workers (hosting)

## 🔒 Privacy

Your resume is edited and rendered entirely in your browser. This project has no backend, so the text you type isn't sent to a server.

## 🤝 Contributing

Bug reports, ideas and pull requests are welcome:

1. Fork the repository
2. Create a branch: `git checkout -b feature/your-feature`
3. Commit your changes and open a pull request

## 👤 Author

Made by [Aarush Oberoi](https://github.com/AarushOberoi)
