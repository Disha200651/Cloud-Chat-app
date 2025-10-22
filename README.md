# Cloud Chat App ☁️💬

A modern, real-time chat application built with React and Firebase, featuring multi-room support, file uploads, AI integration, message reactions, presence indicators, and more.


## ✨ Features

* **Real-time Messaging:** Instant message delivery using Firestore.
* **Authentication:** Secure user login and sign-up via Firebase Authentication (Email/Password).
* **Multi-Room Chat:** Create, browse, search, and join different chat rooms.
* **Join Room Mechanism:** Users must join a room to read/send messages.
* **User Profiles:** Editable display names and profile picture uploads.
* **Avatars:** User avatars displayed next to messages and in the profile section.
* **File & Image Uploads:** Share images and files seamlessly using Cloudinary.
* **AI Integration:** Interact with Google Gemini AI directly within chat rooms using `@ai` mentions.
* **Message Reactions:** React to messages with emojis (👍, ❤️, 😂).
* **Message Editing & Deleting:** Users can edit or delete their own sent messages.
* **Presence Indicators:** See who is currently online via Firebase Realtime Database.
* **Typing Indicators:** See when other users in the room are actively typing.
* **Unread & Mention Indicators:** Visual cues in the room list for new messages or mentions.
* **View Members:** See a list of members currently in a chat room.
* **Responsive Design:** (Ensure your CSS/styles support this) A clean interface designed for modern browsers.

---

## 🛠️ Tech Stack

* **Frontend:** React.js
* **Routing:** React Router DOM
* **Backend Services:** Firebase
    * **Authentication:** Firebase Authentication
    * **Database (Messages, Rooms, Users):** Cloud Firestore
    * **Database (Presence):** Firebase Realtime Database
* **File Storage:** Cloudinary
* **AI:** Google Generative AI (Gemini API - Client-Side)
* **Styling:** Inline Styles / CSS (with CSS Variables)

---

## 🚀 Getting Started

Follow these instructions to set up and run the project locally.

### Prerequisites

* Node.js (v16 or later recommended)
* npm (usually comes with Node.js)
* A Firebase project set up with Authentication, Firestore, and Realtime Database enabled.
* A Cloudinary account (free tier is sufficient).
* A Google AI Studio API key for Gemini.

### Installation & Setup

1.  **Clone the repository:**
    ```bash
    git clone <your-repository-url>
    cd cloud-chat-app
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

3.  **Set up Firebase Configuration:**
    * Go to your Firebase project settings -> General tab.
    * Find your Web App's configuration object.
    * Copy these credentials into `src/firebase.js`, replacing the placeholder `firebaseConfig`.
    * **Important:** Make sure to add your `databaseURL` (from the Realtime Database section of Firebase) to the `firebaseConfig` object.

4.  **Set up Cloudinary Configuration:**
    * Go to your Cloudinary dashboard -> Settings -> Upload.
    * Create an **Unsigned Upload Preset**. Note its name.
    * Find your **Cloud Name** on the dashboard.
    * Open `src/pages/ChatPage.js` (and `src/pages/ProfilePage.js`).
    * Replace the placeholder `CLOUDINARY_CLOUD_NAME` and `CLOUDINARY_UPLOAD_PRESET` constants with your actual values.

5.  **Set up Gemini API Key:**
    * Get your API key from [Google AI Studio](https://aistudio.google.com/).
    * Create a file named `.env.local` in the **root** of your project directory (next to `package.json`).
    * Add your API key to this file in the following format:
        ```
        REACT_APP_GEMINI_API_KEY=YOUR_API_KEY_HERE
        ```
    * **Important:** Restart your development server after creating or modifying this file.

6.  **Set up Firestore:**
    * Ensure you have collections named `users` and `chat-rooms`.
    * `users` documents should have fields like `uid`, `email`, `displayName`, `photoURL`, `online`, `last_active`, `lastReadTimes` (map).
    * `chat-rooms` documents should have fields like `name`, `createdAt`, `members` (array). Create initial rooms like "general" and add your UID to their `members` array.
    * Apply the necessary **Firestore Security Rules** (refer to previous instructions for rules covering all features).

### Running the App

1.  **Start the development server:**
    ```bash
    npm start
    ```
2.  Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 📦 Building for Production

To create an optimized build for deployment:

```bash
npm run build
