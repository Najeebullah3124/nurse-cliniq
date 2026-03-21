# Nurse ClinIQ

**Assessing Clinical Competency for Future Nurses**

A web-based system where nursing students can log in with their student number, view required clinical competencies, take quizzes (multiple-choice, drag-and-drop, matching), and track progress with real-time pass/fail results. Includes an admin panel to manage students, competencies, and quizzes.

---

## Project Summary

- **Student side:** Register/login with student number, dashboard with competency cards and progress bar, take or retake quizzes per competency, view profile.
- **Admin side:** View all students and progress, add/edit/delete competencies, manage quiz questions per competency, add students and reset passwords, export reports (CSV/JSON).
- **Quiz types:** Multiple choice, matching (term to definition), drag-and-drop (order steps).
- **Tech:** Node.js, Express, JSON file store (no database setup required), vanilla HTML/CSS/JS frontend.

---

## Installation

1. **Requirements:** Node.js 18+ (no database or build tools required).

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Seed initial data** (admin user + sample competencies and quizzes):
   ```bash
   npm run seed
   ```

4. **Start the server:**
   ```bash
   npm start
   ```

5. Open **http://localhost:3000** in your browser.

---

## Login Instructions

### Students

- **Register:** Use the “Register” link, enter your student number, full name, and password (email optional).
- **Login:** Enter your student number and password. You will see the Dashboard with all competencies and your progress.

### Admin

- **Login:** Use student number **`admin`** and password **`admin123`**.
- After login you will see the **Admin Dashboard**. Use the tabs: Dashboard (student progress), Competencies, Quizzes, Students, Reports.

---

## Competency Tracking

- Each competency appears as a card with status: **Pending** or **Completed**, and result **Pass** or **Fail** (after taking the quiz).
- The progress bar shows how many competencies are completed. Quizzes can be retaken; the latest result is stored.

---

## Quiz Usage

- From the Dashboard, click **Take Quiz** (or **Retake Quiz**) on a competency.
- Answer all questions. Supported types:
  - **Multiple choice:** Click one option.
  - **Matching:** Choose the correct match from each dropdown.
  - **Drag and drop:** Drag list items to reorder (correct order = correct answer).
- Click **Submit Quiz**. You will see your score and Pass/Fail. A score of 70% or higher is a pass.

---

## Progress Reports & Analytics (Admin)

- **Dashboard tab:** Overview of all students with completed vs total competencies and number passed.
- **Reports tab:** Use **Download JSON** or **Download CSV** to export student performance and competency completion for all students.

---

## System Requirements

- **Browser:** Modern browser (Chrome, Firefox, Edge, Safari) with JavaScript enabled.
- **Network:** For local use, no internet required after loading the page; for deployment, HTTPS is recommended.
- **Devices:** Responsive layout; usable on desktop and mobile.

---

## File Structure

```
clinic/
├── server.js           # Express server and API
├── lib/
│   ├── auth.js         # Password hashing (prototype)
│   ├── db.js           # (unused; kept for reference)
│   └── store.js        # JSON file-based data store
├── public/
│   ├── index.html
│   ├── css/style.css
│   └── js/app.js       # Frontend SPA logic
├── data/               # Created by seed; JSON data files
├── scripts/
│   ├── seed-data.js    # Initial admin, competencies, sample quizzes
│   └── init-db.js      # (optional; SQLite version)
├── package.json
├── Task.txt            # Original requirements
└── README.md           # This file
```

---

## API Overview (for developers)

- **POST /api/auth/register** – Register (student_number, name, password, email optional).
- **POST /api/auth/login** – Login (student_number, password); returns `token` and `user`.
- **GET /api/me** – Current user (Bearer token).
- **GET /api/competencies** – List competencies.
- **GET /api/my-progress** – Current user’s progress per competency.
- **GET /api/quiz/:competencyId** – Quiz questions (no correct answers).
- **POST /api/quiz/:competencyId/submit** – Submit answers; body `{ answers: [] }`.
- **Admin** – All under `/api/admin/*`; require admin user (Bearer token). Includes students, competencies, quizzes, reports export.

---

## Deployment (optional)

### AWS EC2 (example: public IP `16.16.253.8`)

1. **Security group:** Allow inbound **TCP** on the port you use (e.g. **3000**, or **80** if you put Nginx in front).
2. **SSH** (use your key file; keep `CLinic.pem` private and **never commit** it—`*.pem` is in `.gitignore`):
   ```bash
   chmod 400 CLinic.pem
   ssh -i CLinic.pem ubuntu@16.16.253.8
   ```
   *Use `ec2-user@...` instead of `ubuntu@...` if you use Amazon Linux.*
3. **On the server:** Install Node.js 18+, copy the project, run `npm install`, copy `data/` or run `npm run seed`, create `.env` with at least `OPENAI_API_KEY`, `JWT_SECRET`, and optionally:
   ```env
   PUBLIC_HOST=16.16.253.8
   HOST=0.0.0.0
   PORT=3000
   ```
4. **Start:** `npm start` (or use **PM2** / **systemd** so the app stays running).
5. **Open in a browser:** `http://16.16.253.8:3000` (or your domain if you add DNS + HTTPS).

The frontend uses relative URLs (`/api`), so no code change is required when the app and API are served from the same host.

General notes:

- Use **HTTPS** (SSL) for production login when possible.
- Set **`JWT_SECRET`** to a strong random value in production.
- The app uses a JSON file store; for heavy production load, consider PostgreSQL/MySQL and adapt `lib/store.js`.

---

## License

MIT.
