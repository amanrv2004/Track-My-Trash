# Track My Trash - Smart Waste Management System (Backend)

This is the backend for the "Track My Trash" application, built with Node.js, Express, and MongoDB. It handles user authentication, data management for residents, drivers, and administrators, real-time updates via Socket.io, and payment processing with Stripe.

## Features

*   **User Management:** CRUD operations for Residents, Drivers, and Admin roles.
*   **Authentication:** JWT-based login/signup, role-based access control, password hashing.
*   **Resident Features:** View assigned driver, confirm pickups, file complaints, submit emergency requests, manage profile, subscribe to payment plans.
*   **Driver Features:** Update real-time GPS location, view assigned routes, mark pickups, receive emergency requests.
*   **Admin Features:** Manage users, assign drivers to households, manage complaints, manage emergency requests, real-time truck tracking overview.
*   **Real-time Communication:** Socket.io for live driver location updates, emergency alerts, and notifications.
*   **Payment System:** Stripe integration for monthly/yearly subscriptions and webhook handling.
*   **Irregularity Alerts:** CRON job for checking pending complaints, expiring subscriptions, etc.

## Setup Instructions

1.  **Prerequisites:**
    *   Node.js (LTS version recommended)
    *   npm (Node Package Manager)
    *   MongoDB (local or cloud-hosted like MongoDB Atlas)
    *   Stripe Account (for payment integration)

2.  **Clone the repository:**
    ```bash
    git clone <your-repo-url>
    cd track-my-trash/server
    ```

3.  **Install dependencies:**
    ```bash
    npm install
    ```

4.  **Environment Variables:**
    Create a `.env` file in the `track-my-trash/server` directory based on the `.env.example` file:

    ```
    # MongoDB Connection
    MONGO_URI=your_mongodb_connection_string (e.g., mongodb://localhost:27017/trackmytrash or Atlas URI)

    # JWT Secret
    JWT_SECRET=a_very_secret_key_for_jwt_tokens

    # Stripe API Keys
    STRIPE_SECRET_KEY=sk_test_YOUR_STRIPE_SECRET_KEY
    STRIPE_WEBHOOK_SECRET=whsec_YOUR_STRIPE_WEBHOOK_SECRET (get from Stripe Dashboard > Developers > Webhooks)

    # Client URL (for Stripe redirects)
    CLIENT_URL=http://localhost:5173

    # Server Port
    PORT=5000

    # Admin Credentials (for initial admin user seeding)
    ADMIN_EMAIL=admin@trackmytrash.com
    ADMIN_PASSWORD=adminpassword
    ```

    *   **`MONGO_URI`**: Your MongoDB connection string.
    *   **`JWT_SECRET`**: A strong, random string used to sign JWTs.
    *   **`STRIPE_SECRET_KEY`**: Your Stripe secret API key (starts with `sk_test_` or `sk_live_`).
    *   **`STRIPE_WEBHOOK_SECRET`**: The secret for verifying Stripe webhooks. Obtain this from your Stripe Dashboard when setting up the webhook endpoint (`/api/payments/webhook`).
    *   **`CLIENT_URL`**: The URL of your frontend application (e.g., `http://localhost:5173`). This is used by Stripe for success/cancel redirects.
    *   **`PORT`**: The port the backend server will run on.
    *   **`ADMIN_EMAIL`**, **`ADMIN_PASSWORD`**: Credentials for the initial admin user that will be created when the server starts if one doesn't already exist.

5.  **Run the Server:**
    ```bash
    npm start
    ```
    The server will start on the specified `PORT` (default 5000). You should see messages indicating MongoDB connection and admin user seeding (if applicable).

## API Endpoints

All API endpoints are prefixed with `/api/`.

### User Authentication

*   `POST /api/users/register/resident` - Register a new resident user.
    *   Body: `{ name, email, password, houseNo, block, sector, location: {type: "Point", coordinates: [lng, lat]} }`
*   `POST /api/users/login` - Authenticate a user and get a JWT.
    *   Body: `{ email, password }`

### Admin Endpoints (Requires Admin Token)

*   `GET /api/admin/users` - Get all users (residents, drivers, admins).
*   `GET /api/admin/users/:id` - Get a user by ID.
*   `PUT /api/admin/users/:id` - Update user details.
    *   Body: `{ name?, email?, password?, role? }`
*   `DELETE /api/admin/users/:id` - Delete a user.
*   `POST /api/admin/assign-driver` - Assign a driver to a house.
    *   Body: `{ houseId, driverId }`

*   `GET /api/houses` - Get all registered houses.
*   `GET /api/complaints` - Get all complaints.
*   `PUT /api/complaints/:id` - Update a complaint's status.
    *   Body: `{ status: 'pending' | 'in_progress' | 'resolved' }`
*   `GET /api/emergency-requests` - Get all emergency pickup requests.
*   `PUT /api/emergency-requests/:id` - Update an emergency request's status or assign a driver.
    *   Body: `{ status: 'pending' | 'assigned' | 'resolved' | 'cancelled', assignedDriver?: driverId }`

### Driver Endpoints (Requires Driver Token)

*   `POST /api/driver/location` - Update the driver's current GPS location (emits Socket.io event).
    *   Body: `{ latitude, longitude }`
*   `GET /api/driver/route` - Get the assigned route for the current day.
*   `PUT /api/driver/pickup/:houseId` - Mark a house's pickup status.
    *   Body: `{ status: 'Picked' | 'Not Picked' }`

### Resident Endpoints (Requires Resident Token)

*   `GET /api/resident/driver` - Get details of the assigned driver.
*   `POST /api/resident/pickup/confirm` - Confirm a garbage pickup.
*   `POST /api/resident/complaint` - File a new complaint.
    *   Body: `{ subject, description }`
*   `POST /api/resident/emergency-request` - Submit an emergency pickup request (emits Socket.io event).
    *   Body: `{ reason, preferredTime? }`
*   `GET /api/resident/profile` - Get resident's profile details.
*   `PUT /api/resident/profile` - Update resident's profile details.
    *   Body: `{ name?, email?, password?, houseNo?, block?, sector? }`

### Payment Endpoints (Requires Resident Token for checkout, Webhook is public)

*   `POST /api/payments/create-checkout-session` - Create a Stripe checkout session for subscription.
    *   Body: `{ plan: 'monthly' | 'yearly' }`
*   `POST /api/payments/webhook` - Stripe webhook endpoint (configured in Stripe Dashboard).

## Socket.io Events

The backend emits and listens for various Socket.io events for real-time functionality.

### Emitted by Backend

*   `locationUpdate`: Emitted when a driver's location changes (to resident and admin).
*   `emergencyRequest`: Emitted when a resident submits an emergency request (to admin and assigned driver).
*   `newComplaint`: Emitted when a resident files a new complaint (to admin).
*   `pickupStatus`: Emitted when a driver marks a pickup (to resident and admin).
*   `emergencyRequestResolved`: Emitted when an admin resolves an emergency request (to resident and driver).
*   `emergencyRequestAssigned`: Emitted when an admin assigns a driver to an emergency request (to assigned driver).
*   `irregularityAlert`: Emitted by CRON job for alerts (e.g., pending complaints, expiring subscriptions) (to admin).

### Expected from Frontend

*   `join`: Sent by clients to join a specific room (e.g., driver ID, 'admin', house ID).
    *   Payload: `roomName` (String)
