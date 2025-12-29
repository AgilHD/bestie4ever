// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getDatabase } from "firebase/database";

// Your web app's Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyD3BiXLDv22IfcJ-w1VQlMj7Sl9JFBQnuo",
    authDomain: "komposproject-dfe5e.firebaseapp.com",
    databaseURL: "https://komposproject-dfe5e-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "komposproject-dfe5e",
    storageBucket: "komposproject-dfe5e.firebasestorage.app",
    messagingSenderId: "702334195562",
    appId: "1:702334195562:web:cc7a875f559e4afa05b713",
    measurementId: "G-XYNFFN4VNP"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
export const database = getDatabase(app);
