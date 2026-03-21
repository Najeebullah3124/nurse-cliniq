/**
 * Seed initial data for Nurse ClinIQ (JSON store).
 * Run: node scripts/seed-data.js
 */

const fs = require('fs');
const path = require('path');
const { hashPassword } = require('../lib/auth');

const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Admin: student_number "admin", password "admin123"
const adminHash = hashPassword('admin123');

const students = [
  {
    student_id: 1,
    student_number: 'admin',
    name: 'Administrator',
    email: 'admin@nursecliniq.local',
    password_hash: adminHash,
    is_admin: 1,
    registration_date: new Date().toISOString()
  }
];

const competencies = [
  { competency_id: 1, name: 'Patient Safety', description: 'Understanding and applying patient safety protocols and infection control.' },
  { competency_id: 2, name: 'Medication Administration', description: 'Safe administration of medications and dosage calculations.' },
  { competency_id: 3, name: 'Clinical Assessment', description: 'Performing basic physical assessment and vital signs.' },
  { competency_id: 4, name: 'Communication Skills', description: 'Effective communication with patients and healthcare team.' }
];

const student_competency = [
  { id: 1, student_id: 1, competency_id: 1, status: 'Pending', result: null, quiz_score: null, last_attempt: null },
  { id: 2, student_id: 1, competency_id: 2, status: 'Pending', result: null, quiz_score: null, last_attempt: null },
  { id: 3, student_id: 1, competency_id: 3, status: 'Pending', result: null, quiz_score: null, last_attempt: null },
  { id: 4, student_id: 1, competency_id: 4, status: 'Pending', result: null, quiz_score: null, last_attempt: null }
];

const quizzes = [
  { quiz_id: 1, competency_id: 1, question_text: 'What is the first step in hand hygiene?', question_type: 'multiple-choice', options: ['Wet hands', 'Apply soap', 'Rub hands together', 'Rinse hands'], correct_answer: ['Apply soap'], sort_order: 0 },
  { quiz_id: 2, competency_id: 1, question_text: 'Match the term to the definition.', question_type: 'matching', options: { left: ['Hand hygiene', 'PPE', 'Isolation'], right: ['Washing hands', 'Personal protective equipment', 'Contact precautions'] }, correct_answer: { 'Hand hygiene': 'Washing hands', 'PPE': 'Personal protective equipment', 'Isolation': 'Contact precautions' }, sort_order: 1 },
  { quiz_id: 3, competency_id: 2, question_text: 'Order the steps for medication administration.', question_type: 'drag-drop', options: ['Verify order', 'Check patient ID', 'Administer drug', 'Document'], correct_answer: ['Verify order', 'Check patient ID', 'Administer drug', 'Document'], sort_order: 0 }
];

fs.writeFileSync(path.join(dataDir, 'students.json'), JSON.stringify(students, null, 2));
fs.writeFileSync(path.join(dataDir, 'competencies.json'), JSON.stringify(competencies, null, 2));
fs.writeFileSync(path.join(dataDir, 'student_competency.json'), JSON.stringify(student_competency, null, 2));
fs.writeFileSync(path.join(dataDir, 'quizzes.json'), JSON.stringify(quizzes, null, 2));

console.log('Seed data written to', dataDir);
console.log('Admin login: student_number = admin, password = admin123');
