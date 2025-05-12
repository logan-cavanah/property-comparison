# Property Comparison App

## Setup

1. **Install Node.js (v18 or later recommended) and npm.**
   - Download from https://nodejs.org/ if not already installed.

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Set up Firestore database:**
   - Create a Firestore database.
   - Create a new collection with test permissions.
   - Create a new web app in Firestore and copy the relevant config keys into a .env.local folder in the root directory of the project.

4. **Run the development server:**
   ```bash
   npm run dev
   ```
   - The app will be available at `http://localhost:3000`.