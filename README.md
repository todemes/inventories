# Uniform Inventory Management System

A TypeScript/Node.js based uniform inventory management system that helps track uniforms, staff assignments, and stock movements.

## Features

- Uniform management (add, update, delete)
- Stock tracking and updates
- Staff management
- Uniform assignment to staff
- Stock movement history
- CSV export functionality

## Tech Stack

- TypeScript
- Node.js
- Express.js
- SQLite3
- RESTful API

## Prerequisites

- Node.js (v14 or higher)
- npm (v6 or higher)

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd uniform-inventory-ts
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file in the root directory with the following variables:
```
PORT=3000
DB_PATH=uniform_inventory.db
NODE_ENV=development
```

## Running the Application

Development mode:
```bash
npm run dev
```

Production mode:
```bash
npm run build
npm start
```

## API Endpoints

### Uniforms
- GET /api/uniforms - Get all uniforms
- POST /api/uniforms - Add new uniform
- PUT /api/uniforms/:id/stock - Update uniform stock
- DELETE /api/uniforms/:id - Delete uniform

### Staff
- GET /api/staff - Get all staff members
- POST /api/staff - Add new staff member
- PUT /api/staff/:id - Update staff member
- DELETE /api/staff/:id - Delete staff member

## License

ISC 