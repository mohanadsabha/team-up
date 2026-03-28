# 🎓 TeamUp Platform – Backend

This repository contains the backend implementation of the **TeamUp Project**, a web-based system designed to support the full lifecycle of university graduation (capstone) projects.

---

## 🚀 Overview

The backend is built using **Node.js (Express)** and **Prisma ORM**, with **PostgreSQL** as the primary database.
It follows a **modular architecture**, where each feature is encapsulated in its own module for better scalability, maintainability, and separation of concerns.

---

## 🔗 Frontend Repository

The frontend application is developed using **Next.js**:

👉 https://github.com/Hussein-shsx3/TeamUp-Website-Front

---

## 🧠 Key Features

### 👤 User Management

- Multi-role system (Student, Team Admin, Mentor, Graduate, Admin)
- Authentication via:
  - University account (API)
  - Google / LinkedIn (immediate activation)
  - Email (requires admin approval before access is granted)
- Profile management (CV, bio, skills, external links)

### 💡 Project Ideas

- Submit project ideas (free or paid) by Students, Mentors, and Graduates
- Admin approval workflow with rejection feedback and resubmission support
- Idea lifecycle states: `DRAFT → SUBMITTED → PUBLISHED → COMPLETED`
- Browse ideas with limited public preview; full details unlocked via payment
- Team Admin can publish a completed graduation project as a paid idea after project finalization

### 👥 Team Formation

- Create and manage graduation project teams
- Member recruitment filtered **by university, college, and department by default**; users can override filters to search beyond their department
- Role-based open slots: Team Admin specifies required roles and member count
- Join requests with an approval system; applicants can chat with the Team Admin before the request is approved or rejected
- Withdrawal limits: maximum 3 withdrawals per 30-day period to enforce commitment
- Notifications sent to applicant on join request acceptance or rejection

### 📋 Project Collaboration

- Task management system: `ToDo → In Progress → Done` (students update their own assigned tasks)
- Milestone tracking with status control by the Mentor: `Approved / Needs Revision / Rejected`
- File uploads for deliverables, linked to tasks
- Internal team chat for real-time communication
- Comprehensive notifications system (join decisions, task assignments, meeting reminders)

### 🎓 Mentor Integration

- Team Admin sends a mentorship invitation; Mentor accepts or rejects it
- Mentor gains admin-like privileges: create/assign tasks, update milestone statuses, upload files
- Meeting scheduling (Zoom integration ready) with notifications 24h, 1h, and 10min before
- Project completion requires approval from both Team Admin and Mentor
- Mentor can supervise multiple teams from a unified dashboard

### 🧑‍🎓 Graduate Role

- Upload previous graduation projects or new project ideas (with title, summary, description, tools, deliverables, implementation details, and files)
- Mark uploaded content as Free or Paid; set pricing for paid content
- Content goes through the same admin approval workflow (Pending → Approved/Rejected)
- Edit and resubmit rejected content
- View sales history, transaction records, and content analytics (views, saves, purchases)
- Receive and reply to student inquiries/comments on uploaded ideas

### 💳 Payments

- Pay to unlock full project idea details
- Multiple payment methods: PayPal, Credit Card, extensible to other gateways
- Transaction tracking with status records (success / failed / pending)
- Access granted automatically on successful payment confirmation

### 🛡️ Admin Dashboard

- Approve or reject new user registrations (email-based accounts only)
- Review, approve, or reject submitted project ideas with feedback
- Manage user accounts: edit, deactivate, delete, change roles
- Manage teams: view members, intervene (edit/delete) when needed
- Handle complaints and reports from users
- System statistics: active users, pending approvals, active/completed projects, pending ideas
- Manage system settings (academic terms, etc.)

### 🔔 Complaints & Reports

- Any registered user can submit a complaint or report a problem
- Admin receives and resolves reports through a dedicated management interface

---

## 🏗️ Tech Stack

- **Backend Framework:** Express.js
- **ORM:** Prisma
- **Database:** PostgreSQL
- **Authentication:** JWT / OAuth (Google, LinkedIn)
- **API Type:** RESTful API
- **File Storage:** Local / Cloud (configurable)

---

## 📁 Project Structure

```
src/
│
├── modules/
│   ├── auth/
│   │   ├── auth.controller.ts
│   │   ├── auth.routes.ts
│   │   ├── auth.mapper.ts
│   │   ├── auth.validation.ts
│   │   └── auth.interface.ts
│   │
│   ├── users/
│   │   ├── user.controller.ts
│   │   ├── user.routes.ts
│   │   ├── user.mapper.ts
│   │   ├── user.validation.ts
│   │   └── user.interface.ts
│   │
│   └── ...
│
├── prisma/
│   ├── schema.prisma
│   └── migrations/
│
├── middlewares/
├── utils/
├── config/
├── app.ts
└── server.ts
```

---

## ⚙️ Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/mohanadsabha/team-up.git
cd team-up
```

### 2. Install dependencies

```bash
npm install
```

### 3. Setup environment variables

Create a `.env` file:

```env
DATABASE_URL="postgresql://USER:PASSWORD@localhost:5432/db_name"
JWT_SECRET="your_secret_key"
PORT=5000
...
```

### 4. Setup database (Prisma)

```bash
npx prisma migrate dev
npx prisma generate
```

### 5. Run the server

```bash
npm run dev
```

Server will run on:

```
http://localhost:5000
```

---

## 📌 API Overview

Examples:

- `POST /auth/login`
- `POST /auth/register`
- `GET /users`
- `POST /projects`
- `POST /teams/join`
- ... Not completed yet

---

## 📈 Future Improvements

- Real-time features (WebSockets)
- AI-based team and idea recommendations
- Advanced analytics dashboard
- Multi-university support
- Blockchain-based project submission verification

---

## 👨‍💻 Authors

- Mohanad M. Abusabha
- Omar M. Rouk
- Hussein A. Mohammed

---

## 📄 License

This project is developed for academic purposes.
