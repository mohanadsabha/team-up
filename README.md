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
  - Google / LinkedIn
  - Email (with admin approval)
- Profile management (CV, bio, links)

### 💡 Project Ideas
- Submit project ideas (free or paid)
- Admin approval workflow
- Browse ideas with preview access
- Unlock full details via payment

### 👥 Team Formation
- Create and manage project teams
- Role-based member recruitment
- Join requests with approval system
- Withdrawal limits to ensure commitment

### 📋 Project Collaboration
- Task management system (ToDo → In Progress → Done)
- File uploads for deliverables
- Internal team chat
- Notifications system

### 🎓 Mentor Integration
- Mentor assignment to teams
- Task and milestone evaluation
- Meeting scheduling (Zoom integration ready)
- Project approval workflow

### 💳 Payments
- Pay to unlock project details
- Multiple payment methods (extensible)
- Transaction tracking and validation

### 📊 Admin Dashboard
- User and project management
- Idea approval and moderation
- System statistics and monitoring

---

## 🏗️ Tech Stack

- **Backend Framework:** Express.js
- **ORM:** Prisma
- **Database:** PostgreSQL
- **Authentication:** JWT / OAuth (Google, LinkedIn)
- **API Type:** RESTful API
- **File Storage:** (e.g., local / cloud - configurable)

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
└── app.ts
└── serrver.ts
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

---

### 4. Setup database (Prisma)

```bash
npx prisma migrate dev
npx prisma generate
```

---

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
- AI-based recommendations
- Advanced analytics dashboard
- Multi-university support

---

## 👨‍💻 Authors

- Mohanad M. Absabha
- Omar Y. Rouk
- Hussein A. Mohammed

---

## 📄 License

This project is developed for academic purposes.
