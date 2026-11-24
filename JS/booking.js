import { showToast } from "./toast.js";

"use strict";

const ticketBookingForm = document.getElementById("ticketBookingForm");
const formMessage = document.getElementById("formMessage");
const customerName = document.getElementById("customerName");

customerName.addEventListener("input", () => {
  const cursorPosition = customerName.selectionStart;
  const nameBeforeCursor = customerName.value.slice(0, cursorPosition).replace(/[0-9]/g, "");
  customerName.value = customerName.value.replace(/[0-9]/g, "");
  customerName.setSelectionRange(nameBeforeCursor.length, nameBeforeCursor.length);
});

ticketBookingForm.addEventListener("submit", event => {
  event.preventDefault();
  const message = "Your details are valid. This demo does not send or save your information.";
  formMessage.textContent = message;
  formMessage.classList.add("is-success");
  showToast(message);
});

ticketBookingForm.addEventListener("reset", () => {
  formMessage.textContent = "";
  formMessage.classList.remove("is-success");
});
