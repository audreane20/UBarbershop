import { initializeApp } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyCqa5b3zQ2DH2cZ1gSZmt6c0t2fUriIYnY",
    authDomain: "ubarbershop-39fce.firebaseapp.com",
    projectId: "ubarbershop-39fce",
    storageBucket: "ubarbershop-39fce.firebasestorage.app",
    messagingSenderId: "221654010645",
    appId: "1:221654010645:web:f03125ff799e290498771c",
    measurementId: "G-YPXSCK9R5D"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
