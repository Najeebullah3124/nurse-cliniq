# Nurse ClinIQ – User Guide

This guide explains how to use Nurse ClinIQ as a **student** or as an **administrator**.

---

## For Students

### Getting started

1. Open the application in your browser (e.g. **http://localhost:3000** if running locally).
2. If you do not have an account, click **Register**.
3. Enter your **student number**, **full name**, and **password**. Email is optional.
4. After registering, you are logged in and see your **Dashboard**.

### Logging in later

1. Open the application.
2. Enter your **student number** and **password**.
3. Click **Sign in**.

### Dashboard

- You see a list of **competencies** (e.g. Patient Safety, Medication Administration).
- Each card shows:
  - Competency name and short description
  - **Status:** Pending or Completed
  - **Result:** Pass or Fail (after you take the quiz)
  - **Score:** Percentage (if you have taken the quiz)
- A **progress bar** at the top shows how many competencies you have completed.
- Use **Take Quiz** or **Retake Quiz** to open the quiz for that competency.

### Taking a quiz

1. Click **Take Quiz** (or **Retake Quiz**) on a competency.
2. You will see several questions. Types:
   - **Multiple choice:** Click the one correct answer.
   - **Matching:** For each term, choose the correct definition from the dropdown.
   - **Drag and drop:** Drag the rows to put the steps in the correct order.
3. When finished, click **Submit Quiz**.
4. You will see your **score** and whether you **Passed** or **Did not pass**. Passing is 70% or higher.
5. Click **Back to Dashboard** to return. Your progress and result are saved.

### Profile

- Use **Profile** in the top menu to see your **student number**, **name**, and **email** (if provided).

---

## For Administrators

### Logging in as admin

- **Student number:** `admin`  
- **Password:** `admin123`  

*(Change this in production or via the data files.)*

After login you see the **Admin Dashboard** with tabs: **Dashboard**, **Competencies**, **Quizzes**, **Students**, **Reports**.

### Dashboard tab

- Lists all **students** (except other admins).
- For each student you see:
  - Student number and name
  - How many competencies are **completed** (e.g. 2 / 4)
  - How many are **passed**

### Competencies tab

- **Add a competency:** Enter name and optional description, then click **Add**.
- The table lists all competencies. You can **Delete** a competency (this also removes its quiz questions and progress for that competency).

### Quizzes tab

- Choose a **competency** from the dropdown to see its quiz questions.
- You can **Delete** any question.
- To **add a question:**
  1. Select the competency.
  2. Fill in **Question text**.
  3. Choose **Type:** Multiple choice, Matching, or Drag and drop.
  4. **Options (JSON):**
     - Multiple choice: `["Option A", "Option B", "Correct answer"]`
     - Matching: `{"left": ["Term 1", "Term 2"], "right": ["Definition 1", "Definition 2"]}`
     - Drag and drop: `["Step 1", "Step 2", "Step 3"]`
  5. **Correct answer (JSON):**
     - Multiple choice: `["Correct answer"]`
     - Matching: `{"Term 1": "Definition 1", "Term 2": "Definition 2"}`
     - Drag and drop: `["Step 1", "Step 2", "Step 3"]` (exact order)
  6. Click **Add question**.

### Students tab

- **Add a student:** Enter student number, full name, and password, then click **Add student**.
- For each student you can click **Reset password** and enter a new password.

### Reports tab

- **Download JSON:** Downloads a JSON file with all students and their competency status, result, score, and last attempt.
- **Download CSV:** Same data in CSV format for use in spreadsheets.

---

## Support

- For technical or installation issues, refer to the main **README.md** in the project folder.
- Ensure you use a supported browser and that JavaScript is enabled.
