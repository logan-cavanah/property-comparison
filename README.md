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

5. **If you want some data in your firebase**
- Run the app
- Log in with google or email
- Go to Zoopla or rightmove and copy a property URL and paste it into the "Add" section in the app.