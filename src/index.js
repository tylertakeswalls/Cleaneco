import React from 'react';
import ReactDOM from 'react-dom/client';
import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap/dist/js/bootstrap.bundle.min.js';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';

// Initialize session from localStorage if "Remember Me" was used previously
if (!sessionStorage.getItem("loggedInUser") && localStorage.getItem("loggedInUser")) {
  sessionStorage.setItem("loggedInUser", localStorage.getItem("loggedInUser"));
  if (localStorage.getItem("userId")) sessionStorage.setItem("userId", localStorage.getItem("userId"));
  if (localStorage.getItem("userRole")) sessionStorage.setItem("userRole", localStorage.getItem("userRole"));
  if (localStorage.getItem("userEmail")) sessionStorage.setItem("userEmail", localStorage.getItem("userEmail"));
  if (localStorage.getItem("userName")) sessionStorage.setItem("userName", localStorage.getItem("userName"));
  if (localStorage.getItem("token")) sessionStorage.setItem("token", localStorage.getItem("token"));
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
