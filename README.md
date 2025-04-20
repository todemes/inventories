# Uniform Inventory Management System

A web-based application for managing uniform inventory, staff assignments, and tracking uniform history.

## Features

- **Stock Management**
  - Add, update, and delete uniforms
  - Track current stock levels
  - View assigned uniforms
  - Export inventory to CSV

- **Staff Management**
  - Add and manage staff members
  - Assign uniforms to staff
  - Track uniform assignments
  - Return uniforms with status tracking

- **History Tracking**
  - View assignment history
  - Track uniform returns
  - Monitor uniform conditions

## Technologies Used

- Frontend: HTML, CSS, JavaScript, Bootstrap 5
- Backend: Node.js, Express
- Database: SQLite
- API: RESTful

## Setup Instructions

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/uniform-inventory.git
   cd uniform-inventory
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

4. Access the application at `http://localhost:3000`

## Project Structure

```
uniform-inventory/
├── src/
│   ├── controllers/
│   ├── routes/
│   ├── services/
│   └── index.ts
├── uniform-inventory/
│   ├── css/
│   ├── js/
│   └── *.html
├── package.json
└── README.md
```

## Contributing

Feel free to submit issues and enhancement requests.

## License

This project is licensed under the MIT License. 