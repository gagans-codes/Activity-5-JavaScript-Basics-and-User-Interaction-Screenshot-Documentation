let toastTimer;
const toastMessage = document.getElementById("toastMessage");

if (!toastMessage) {
  throw new Error("The toast message element is missing from this page.");
}

export function showToast(message) {
  toastMessage.textContent = message;
  toastMessage.classList.add("is-visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toastMessage.classList.remove("is-visible");
  }, 5000);
}
