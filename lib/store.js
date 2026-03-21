/**
 * JSON file-based store for Nurse ClinIQ (no native DB dependency).
 * Data files: data/students.json, competencies.json, student_competency.json, quizzes.json
 */

const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, '..', 'data');

function ensureDir() {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
}

function read(name) {
  ensureDir();
  const file = path.join(dataDir, name + '.json');
  if (!fs.existsSync(file)) return [];
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function write(name, data) {
  ensureDir();
  const file = path.join(dataDir, name + '.json');
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
}

// Students
function getStudents() {
  return read('students');
}

function getStudentById(id) {
  return getStudents().find(s => s.student_id === id);
}

function getStudentByNumber(student_number) {
  return getStudents().find(s => s.student_number === student_number);
}

function addStudent(student) {
  const students = getStudents();
  const student_id = students.length ? Math.max(...students.map(s => s.student_id)) + 1 : 1;
  const row = { student_id, ...student, registration_date: new Date().toISOString() };
  students.push(row);
  write('students', students);
  return row;
}

function updateStudent(student_id, updates) {
  const students = getStudents();
  const i = students.findIndex(s => s.student_id === student_id);
  if (i === -1) return null;
  students[i] = { ...students[i], ...updates };
  write('students', students);
  return students[i];
}

function deleteStudent(student_id) {
  const all = getStudents();
  const students = all.filter(s => s.student_id !== student_id);
  if (students.length === all.length) return false;
  write('students', students);
  const sc = getStudentCompetency().filter(s => s.student_id !== student_id);
  write('student_competency', sc);
  return true;
}

// Competencies
function getCompetencies() {
  return read('competencies');
}

function getCompetencyById(id) {
  return getCompetencies().find(c => c.competency_id === id);
}

function addCompetency(competency) {
  const comps = getCompetencies();
  const competency_id = comps.length ? Math.max(...comps.map(c => c.competency_id)) + 1 : 1;
  const row = { competency_id, ...competency };
  comps.push(row);
  write('competencies', comps);
  return row;
}

function updateCompetency(competency_id, updates) {
  const comps = getCompetencies();
  const i = comps.findIndex(c => c.competency_id === competency_id);
  if (i === -1) return null;
  comps[i] = { ...comps[i], ...updates };
  write('competencies', comps);
  return comps[i];
}

function deleteCompetency(competency_id) {
  const comps = getCompetencies().filter(c => c.competency_id !== competency_id);
  write('competencies', comps);
  const sc = getStudentCompetency().filter(s => s.competency_id !== competency_id);
  write('student_competency', sc);
  const quizzes = getQuizzes().filter(q => q.competency_id !== competency_id);
  write('quizzes', quizzes);
}

// Student_Competency
function getStudentCompetency() {
  return read('student_competency');
}

function getProgressByStudent(student_id) {
  return getStudentCompetency().filter(sc => sc.student_id === student_id);
}

function ensureStudentCompetencyRows(studentId) {
  const competencies = getCompetencies();
  const sc = getStudentCompetency();
  let nextId = sc.length ? Math.max(...sc.map(x => x.id || 0)) + 1 : 1;
  let changed = false;
  for (const c of competencies) {
    if (!sc.some(s => s.student_id === studentId && s.competency_id === c.competency_id)) {
      sc.push({
        id: nextId++,
        student_id: studentId,
        competency_id: c.competency_id,
        status: 'Pending',
        result: null,
        quiz_score: null,
        last_attempt: null
      });
      changed = true;
    }
  }
  if (changed) write('student_competency', sc);
}

function updateProgress(student_id, competency_id, updates) {
  const sc = getStudentCompetency();
  const i = sc.findIndex(s => s.student_id === student_id && s.competency_id === competency_id);
  if (i === -1) return null;
  sc[i] = { ...sc[i], ...updates };
  write('student_competency', sc);
  return sc[i];
}

// Quizzes
function getQuizzes() {
  return read('quizzes');
}

function getQuizzesByCompetency(competency_id) {
  return getQuizzes().filter(q => q.competency_id === competency_id).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0) || a.quiz_id - b.quiz_id);
}

function getQuizById(quiz_id) {
  return getQuizzes().find(q => q.quiz_id === quiz_id);
}

function addQuiz(quiz) {
  const quizzes = getQuizzes();
  const quiz_id = quizzes.length ? Math.max(...quizzes.map(q => q.quiz_id)) + 1 : 1;
  const row = { quiz_id, sort_order: 0, ...quiz };
  quizzes.push(row);
  write('quizzes', quizzes);
  return row;
}

function updateQuiz(quiz_id, updates) {
  const quizzes = getQuizzes();
  const i = quizzes.findIndex(q => q.quiz_id === quiz_id);
  if (i === -1) return null;
  quizzes[i] = { ...quizzes[i], ...updates };
  write('quizzes', quizzes);
  return quizzes[i];
}

function deleteQuiz(quiz_id) {
  const quizzes = getQuizzes().filter(q => q.quiz_id !== quiz_id);
  write('quizzes', quizzes);
}

module.exports = {
  getStudents,
  getStudentById,
  getStudentByNumber,
  addStudent,
  updateStudent,
  deleteStudent,
  getCompetencies,
  getCompetencyById,
  addCompetency,
  updateCompetency,
  deleteCompetency,
  getStudentCompetency,
  getProgressByStudent,
  ensureStudentCompetencyRows,
  updateProgress,
  getQuizzes,
  getQuizzesByCompetency,
  getQuizById,
  addQuiz,
  updateQuiz,
  deleteQuiz
};
