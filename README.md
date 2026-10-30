# Personal Expense Tracker

A responsive expense-tracking dashboard built with plain HTML, CSS and JavaScript. No frameworks, no backend and no paid APIs. Open `index.html` in a browser and it works.

## Features

- Dashboard with Total Balance, Total Income, Total Expenses and Remaining Budget
- Income vs expenses chart (last 6 months) and category spending breakdown, drawn with CSS (no chart library)
- Add, edit and delete transactions (delete asks for confirmation)
- Validation with clear error and success messages
- Search by title or notes; filter by type, category and date range; sort by newest, oldest, highest or lowest amount; one-click reset
- Monthly budget with progress bar, a warning at 80% and an alert when exceeded (selected month only)
- Data saved in the browser's LocalStorage, including theme preference
- Export to CSV, import from CSV (validated, duplicates skipped), reset all data
- Optional demo data, clearly labelled "Demo" and removable
- Light and dark themes; responsive layout (sidebar on desktop, bottom navigation on mobile)
- Amounts shown in Indian Rupees (₹)

## Technologies

HTML5, CSS3 (custom properties, grid, flexbox), vanilla JavaScript (ES6+), LocalStorage.

## Screenshots

Add screenshots later:

1. Run the app and take screenshots (dashboard, transactions, mobile view).
2. Create a `screenshots/` folder and save the images there.
3. Add them below:

```md
![Dashboard](screenshots/dashboard.png)
![Transactions](screenshots/transactions.png)
```

## Installation and usage

1. Download or clone this repository.
2. Open `index.html` in a modern browser (Chrome, Edge, Firefox, Safari).
3. Click **Add transaction** to start, or go to **Data → Load demo data** to explore.

## Project structure

```
personal-expense-tracker/
├── index.html   # Page structure and dialogs
├── style.css    # Layout, themes and responsive styles
├── script.js    # App logic, storage, charts, CSV
└── README.md
```

## Deploy with GitHub Pages

1. Push the files to a GitHub repository named `personal-expense-tracker`.
2. Open **Settings → Pages**.
3. Under **Build and deployment**, choose **Deploy from a branch**, select `main` and `/ (root)`, then **Save**.
4. After a minute, your site is live at `https://<your-username>.github.io/personal-expense-tracker/`.

## Known limitations

- Data lives only in this browser on this device. There is no cloud or multi-device sync.
- Clearing browser data, or using private browsing, removes your records. Export a CSV regularly as a backup.
- One budget amount applies to every month.
- Single currency (₹).
