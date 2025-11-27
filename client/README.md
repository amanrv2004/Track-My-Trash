# Track My Trash - Smart Waste Management System (Frontend)

This is the frontend for the "Track My Trash" application, built with React and Vite. It provides an interactive user interface for Residents, Drivers, and Administrators to manage waste collection efficiently.

## Features

*   **Responsive UI:** Built with React and Bootstrap for a clean and modern design.
*   **User Dashboards:** Dedicated dashboards for Residents, Drivers, and Admins with role-specific functionalities.
*   **Authentication:** User login and resident registration.
*   **Real-time Tracking:** Live driver location tracking on Leaflet maps (for residents and admins).
*   **Emergency Requests:** Residents can submit emergency pickup requests, with real-time notifications to admin and drivers.
*   **Complaint System:** Residents can file complaints, with real-time alerts to admins.
*   **Payment Integration:** Stripe integration for subscription management.

## Setup Instructions

1.  **Prerequisites:**
    *   Node.js (LTS version recommended)
    *   npm (Node Package Manager)
    *   Ensure the [backend server](https://github.com/your-repo/track-my-trash/tree/main/server) is set up and running.

2.  **Clone the repository:**
    ```bash
    git clone <your-repo-url>
    cd track-my-trash/client
    ```

3.  **Install dependencies:**
    ```bash
    npm install
    ```

4.  **Environment Variables:**
    Create a `.env` file in the `track-my-trash/client` directory based on the example below:

    ```
    VITE_SERVER_URL=http://localhost:5000
    VITE_STRIPE_PUBLIC_KEY=pk_test_YOUR_STRIPE_PUBLIC_KEY
    ```

    *   **`VITE_SERVER_URL`**: The URL where your backend server is running (e.g., `http://localhost:5000`).
    *   **`VITE_STRIPE_PUBLIC_KEY`**: Your Stripe publishable API key (starts with `pk_test_` or `pk_live_`).

5.  **Run the Client:**
    ```bash
    npm run dev
    ```
    The client will typically open in your browser at `http://localhost:5173`.

## Available Scripts

In the project directory, you can run:

*   `npm run dev`: Runs the app in development mode.
*   `npm run build`: Builds the app for production to the `dist` folder.
*   `npm run lint`: Lints the code.
*   `npm run preview`: Serves the production build locally.