/**
 * Database initialization script for Nurse ClinIQ.
 * Creates all tables and seeds sample data for demonstration.
 */

const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'data', 'clinic.db');

// Ensure data directory exists
const fs = require('fs');
const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(dbPath);

// Enable foreign keys
db.pragma('foreign_keys = ON');

// Students table
db.exec(`
  CREATE TABLE IF NOT EXISTS students (
    student_id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_number VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    password_hash VARCHAR(255) NOT NULL,
    is_admin INTEGER DEFAULT 0,
    registration_date DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// Competencies table
db.exec(`
  CREATE TABLE IF NOT EXISTS competencies (
    competency_id INTEGER PRIMARY KEY AUTOINCREMENT,
    name VARCHAR(255) NOT NULL,
    description TEXT
  );
`);

// Student_Competency (progress tracking)
db.exec(`
  CREATE TABLE IF NOT EXISTS student_competency (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id INTEGER NOT NULL REFERENCES students(student_id),
    competency_id INTEGER NOT NULL REFERENCES competencies(competency_id),
    status VARCHAR(20) DEFAULT 'Pending' CHECK (status IN ('Pending', 'Completed')),
    result VARCHAR(10) CHECK (result IN ('Pass', 'Fail')),
    quiz_score INTEGER,
    last_attempt DATETIME,
    UNIQUE(student_id, competency_id)
  );
`);

// Quizzes table (one row per question)
db.exec(`
  CREATE TABLE IF NOT EXISTS quizzes (
    quiz_id INTEGER PRIMARY KEY AUTOINCREMENT,
    competency_id INTEGER NOT NULL REFERENCES competencies(competency_id),
    question_text TEXT NOT NULL,
    question_type VARCHAR(30) NOT NULL CHECK (question_type IN ('multiple-choice', 'drag-drop', 'matching')),
    options TEXT NOT NULL,
    correct_answer TEXT NOT NULL,
    sort_order INTEGER DEFAULT 0
  );
`);

// Seed default admin (student_number: admin, password: admin123)
const bcryptHash = (str) => {
  // Simple hash for prototype; in production use bcrypt
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) - h) + str.charCodeAt(i) | 0;
  }
  return 'hash_' + Math.abs(h).toString(16);
};

const adminExists = db.prepare('SELECT 1 FROM students WHERE student_number = ?').get('admin');
if (!adminExists) {
  db.prepare(`
    INSERT INTO students (student_number, name, email, password_hash, is_admin)
    VALUES (?, ?, ?, ?, 1)
  `).run('admin', 'Administrator', 'admin@nursecliniq.local', bcryptHash('admin123'));
}

// Seed sample competencies if empty
const compCount = db.prepare('SELECT COUNT(*) as c FROM competencies').get();
if (compCount.c === 0) {
  const insertComp = db.prepare('INSERT INTO competencies (name, description) VALUES (?, ?)');
  insertComp.run('Patient Safety', 'Understanding and applying patient safety protocols and infection control.');
  insertComp.run('Medication Administration', 'Safe administration of medications and dosage calculations.');
  insertComp.run('Clinical Assessment', 'Performing basic physical assessment and vital signs.');
  insertComp.run('Communication Skills', 'Effective communication with patients and healthcare team.');
}

// Seed sample quiz questions for first competency
const quizCount = db.prepare('SELECT COUNT(*) as c FROM quizzes').get();
if (quizCount.c === 0) {
  const insertQuiz = db.prepare(`
    INSERT INTO quizzes (competency_id, question_text, question_type, options, correct_answer, sort_order)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  insertQuiz.run(1, 'What is the first step in hand hygiene?', 'multiple-choice',
    JSON.stringify(['Wet hands', 'Apply soap', 'Rub hands together', 'Rinse hands']),
    JSON.stringify(['Apply soap']), 0);
  insertQuiz.run(1, 'Match the term to the definition.', 'matching',
    JSON.stringify({ left: ['Hand hygiene', 'PPE', 'Isolation'], right: ['Washing hands', 'Personal protective equipment', 'Contact precautions'] }),
    JSON.stringify({ 'Hand hygiene': 'Washing hands', 'PPE': 'Personal protective equipment', 'Isolation': 'Contact precautions' }), 1);
  insertQuiz.run(2, 'Order the steps for medication administration.', 'drag-drop',
    JSON.stringify(['Verify order', 'Check patient ID', 'Administer drug', 'Document']),
    JSON.stringify(['Verify order', 'Check patient ID', 'Administer drug', 'Document']), 0);
}

console.log('Database initialized at', dbPath);
db.close();
