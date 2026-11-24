import { showToast } from "./toast.js";
import { supabaseClient } from "./supabase.js";

"use strict";

const demoTeams = [
  { name: "Chennai Super Kings", short: "CSK", slug: "csk", color: "#f6c443", city: "Chennai", ground: "M. A. Chidambaram Stadium" },
  { name: "Mumbai Indians", short: "MI", slug: "mi", color: "#3d8cff", city: "Mumbai", ground: "Wankhede Stadium" },
  { name: "Royal Challengers Bengaluru", short: "RCB", slug: "rcb", color: "#ed3d51", city: "Bengaluru", ground: "M. Chinnaswamy Stadium" },
  { name: "Kolkata Knight Riders", short: "KKR", slug: "kkr", color: "#b28aff", city: "Kolkata", ground: "Eden Gardens" },
  { name: "Sunrisers Hyderabad", short: "SRH", slug: "srh", color: "#ff9149", city: "Hyderabad", ground: "Rajiv Gandhi International Cricket Stadium" },
  { name: "Rajasthan Royals", short: "RR", slug: "rr", color: "#ff76bb", city: "Jaipur", ground: "Sawai Mansingh Stadium" },
  { name: "Delhi Capitals", short: "DC", slug: "dc", color: "#5797ff", city: "Delhi", ground: "Arun Jaitley Stadium" },
  { name: "Punjab Kings", short: "PBKS", slug: "pbks", color: "#fa5968", city: "New Chandigarh", ground: "Maharaja Yadavindra Singh International Cricket Stadium" },
  { name: "Gujarat Titans", short: "GT", slug: "gt", color: "#73b8c8", city: "Ahmedabad", ground: "Narendra Modi Stadium" },
  { name: "Lucknow Super Giants", short: "LSG", slug: "lsg", color: "#58d2df", city: "Lucknow", ground: "BRSABV Ekana Cricket Stadium" }
];

let teams = demoTeams;

const demoMatches = [
  { home: "RCB", away: "CSK", venue: "M. Chinnaswamy Stadium", city: "Bengaluru" },
  { home: "MI", away: "KKR", venue: "Wankhede Stadium", city: "Mumbai" },
  { home: "SRH", away: "GT", venue: "Rajiv Gandhi International Cricket Stadium", city: "Hyderabad" },
  { home: "RR", away: "DC", venue: "Sawai Mansingh Stadium", city: "Jaipur" },
  { home: "PBKS", away: "LSG", venue: "Maharaja Yadavindra Singh International Cricket Stadium", city: "New Chandigarh" },
  { home: "CSK", away: "MI", venue: "M. A. Chidambaram Stadium", city: "Chennai" },
  { home: "GT", away: "RCB", venue: "Narendra Modi Stadium", city: "Ahmedabad" },
  { home: "KKR", away: "SRH", venue: "Eden Gardens", city: "Kolkata" }
];

const demoTicketCategories = [
  { id: "900", name: "General Stand", price: 900, availableSeats: null },
  { id: "1800", name: "Premium Stand", price: 1800, availableSeats: null },
  { id: "3200", name: "VIP Lounge", price: 3200, availableSeats: null }
];
let matches = demoMatches.map((match, index) => ({
  ...match,
  id: String(index),
  matchDate: "",
  matchNumber: index + 1,
  status: "upcoming",
  title: "",
  categories: demoTicketCategories
}));

const demoStadiums = [
  { name: "Wankhede Stadium", city: "Mumbai", capacity: "A sea of blue, right by the coast" },
  { name: "M. A. Chidambaram Stadium", city: "Chennai", capacity: "A fortress with a roaring yellow wall" },
  { name: "M. Chinnaswamy Stadium", city: "Bengaluru", capacity: "Big-city energy, boundary after boundary" },
  { name: "Narendra Modi Stadium", city: "Ahmedabad", capacity: "A grand stage for a massive crowd" }
];
let stadiums = demoStadiums;
let teamByShort = new Map(teams.map(team => [team.short, team]));
const feeRate = 0.05;
const bookingStorageKey = "ipl-ticket-arena-demo-bookings";
let activeTeamFilter = "";
let pendingBooking = null;
let savedBookings = [];
let realtimeChannel = null;

const matchGrid = document.getElementById("matchGrid");
const teamsGrid = document.getElementById("teamsGrid");
const matchTeamFilter = document.getElementById("matchTeamFilter");
const bookingForm = document.getElementById("bookingForm");
const matchSelect = document.getElementById("matchSelect");
const ticketType = document.getElementById("ticketType");
const quantityInput = document.getElementById("quantity");
const bookingMessage = document.getElementById("bookingMessage");
const storageMessage = document.getElementById("storageMessage");
const reviewDialog = document.getElementById("reviewDialog");
const reviewSummary = document.getElementById("reviewSummary");
const summaryMatch = document.querySelector("#bookingSummary #summaryMatch");
const summaryCategory = document.querySelector("#bookingSummary #summaryCategory");
const summaryQuantity = document.querySelector("#bookingSummary #summaryQuantity");
const pricePerTicket = document.querySelector("#bookingSummary #pricePerTicket");
const numberFormat = new Intl.NumberFormat("en-IN");

function formatRupees(amount) {
  return `₹${numberFormat.format(amount)}`;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, character => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[character]);
}

function getTeam(shortName) {
  return teamByShort.get(shortName) || {
    name: "Team TBA",
    short: shortName || "TBA",
    slug: "",
    color: "#8797ae",
    city: "",
    ground: "",
    logoUrl: ""
  };
}

function getTeamLogo(team, extraClass = "") {
  const localTeam = demoTeams.find(item => item.short === team.short);
  const logoUrl = localTeam
    ? `img/${localTeam.slug}.svg`
    : team.logoUrl || "";
  const logo = logoUrl
    ? `<img src="${escapeHtml(logoUrl)}" alt="${escapeHtml(team.name)} logo" loading="lazy">`
    : "";
  const unavailableClass = logoUrl ? "" : " logo-unavailable";

  return `
    <span class="team-mark ${extraClass}${unavailableClass}" style="--team-color:${escapeHtml(team.color)}">
      ${logo}
      <span class="logo-fallback" aria-hidden="true">${escapeHtml(team.short)}</span>
    </span>
  `;
}

function attachLogoFallbacks(container) {
  container.querySelectorAll(".team-mark img").forEach(image => {
    image.addEventListener("error", () => {
      image.hidden = true;
      image.closest(".team-mark").classList.add("logo-unavailable");
    }, { once: true });
  });
}

function renderTeams() {
  const selectedTeam = matchTeamFilter.value;
  matchTeamFilter.innerHTML = '<option value="">All teams</option>' + teams.map(team =>
    `<option value="${escapeHtml(team.short)}">${escapeHtml(team.name)}</option>`
  ).join("");
  matchTeamFilter.value = teams.some(team => team.short === selectedTeam) ? selectedTeam : "";

  teamsGrid.innerHTML = teams.map(team => `
    <article class="team-card" style="--team-color:${escapeHtml(team.color)}">
      <div class="team-card-top"><span class="team-card-index">${escapeHtml(team.short)}</span><span class="team-spark" aria-hidden="true">✦</span></div>
      ${getTeamLogo(team)}
      <h3>${escapeHtml(team.name)}</h3>
      <p class="team-city">${escapeHtml(team.city)}</p>
      <button class="team-match-link" type="button" data-team="${escapeHtml(team.short)}">
        View matches <span aria-hidden="true">↗</span>
      </button>
    </article>
  `).join("");
  attachLogoFallbacks(teamsGrid);
}

function renderStadiums() {
  const stadiumGrid = document.getElementById("stadiumGrid");
  stadiumGrid.innerHTML = stadiums.map((stadium, index) => `
    <article class="stadium-card">
      <span class="stadium-number">${String(index + 1).padStart(2, "0")}</span>
      <span class="stadium-pin" aria-hidden="true">⌖</span>
      <h3>${escapeHtml(stadium.name)}</h3>
      <p>${escapeHtml(stadium.city)}</p>
      <span class="stadium-capacity">${escapeHtml(stadium.capacity)}</span>
    </article>
  `).join("");
}

async function loadSupabaseData() {
  const client = supabaseClient;
  if (!client) {
    throw new Error("Supabase client is not configured.");
  }

  const [teamResult, stadiumResult, matchResult, categoryResult] = await Promise.all([
    client.from("teams").select("id,team_name,short_name,logo_url").order("team_name"),
    client.from("stadiums").select("id,stadium_name,city,capacity").order("stadium_name"),
    client.from("matches")
      .select("id,team1_id,team2_id,stadium_id,match_title,match_date,match_number,status")
      .order("match_date"),
    client.from("ticket_categories")
      .select("id,match_id,category_name,price,total_seats,available_seats")
      .order("price")
  ]);

  if (teamResult.error) throw new Error(`Could not load teams: ${teamResult.error.message}`);
  if (stadiumResult.error) throw new Error(`Could not load stadiums: ${stadiumResult.error.message}`);
  if (matchResult.error) throw new Error(`Could not load matches: ${matchResult.error.message}`);
  if (categoryResult.error) throw new Error(`Could not load ticket categories: ${categoryResult.error.message}`);
  if (!teamResult.data.length || !stadiumResult.data.length || !matchResult.data.length) {
    document.getElementById("databaseMessage").textContent =
      "Supabase is connected, but teams, stadiums, or matches have no records. Showing demo data until records are added.";
    return;
  }

  const loadedTeams = teamResult.data.map(team => {
    const displayDetails = demoTeams.find(item => item.short === team.short_name);
    return {
      ...displayDetails,
      id: team.id,
      name: team.team_name,
      short: team.short_name,
      slug: String(team.short_name).toLowerCase(),
      logoUrl: team.logo_url || "",
      color: displayDetails ? displayDetails.color : "#3184ff",
      city: displayDetails ? displayDetails.city : "",
      ground: displayDetails ? displayDetails.ground : ""
    };
  });
  const teamsById = new Map(loadedTeams.map(team => [team.id, team]));
  const loadedStadiums = stadiumResult.data.map(stadium => ({
    name: stadium.stadium_name,
    city: stadium.city,
    capacity: `${Number(stadium.capacity).toLocaleString("en-IN")} seats`
  }));
  const stadiumsById = new Map(stadiumResult.data.map(stadium => [stadium.id, stadium]));
  const categoriesByMatch = new Map();

  categoryResult.data.forEach(category => {
    if (!categoriesByMatch.has(category.match_id)) {
      categoriesByMatch.set(category.match_id, []);
    }
    categoriesByMatch.get(category.match_id).push({
      id: category.id,
      name: category.category_name,
      price: Number(category.price),
      availableSeats: Number(category.available_seats)
    });
  });

  const loadedMatches = matchResult.data.map((match, index) => {
    const home = teamsById.get(match.team1_id);
    const away = teamsById.get(match.team2_id);
    const stadium = stadiumsById.get(match.stadium_id);
    return {
      id: match.id,
      home: home ? home.short : "TBA",
      away: away ? away.short : "TBA",
      venue: stadium ? stadium.stadium_name : "Venue TBA",
      city: stadium ? stadium.city : "",
      matchDate: match.match_date,
      matchNumber: match.match_number || index + 1,
      status: match.status || "upcoming",
      title: match.match_title || "",
      categories: categoriesByMatch.get(match.id) || []
    };
  });

  teams = loadedTeams;
  teamByShort = new Map(teams.map(team => [team.short, team]));
  stadiums = loadedStadiums;
  matches = loadedMatches;
  activeTeamFilter = "";
  document.getElementById("matchFilter").hidden = true;
  matchTeamFilter.value = "";
  document.getElementById("fixtureNoticeText").textContent =
    "Match, stadium, and ticket category details are read from Supabase. Bookings remain demo-only.";
  document.getElementById("ticketPriceNote").textContent =
    "Ticket prices are read from Supabase. This form does not create a real booking.";
  document.getElementById("matchListingStatus").textContent = "LIVE DATABASE DATA";
  document.getElementById("databaseMessage").classList.remove("is-error");
  document.getElementById("databaseMessage").textContent = categoryResult.data.length
    ? "Public IPL data loaded from Supabase."
    : "Public match data loaded, but no ticket categories are available yet.";

  renderTeams();
  renderStadiums();
  renderMatches();
  populateMatchSelect();
  populateTicketCategories();
  renderSelectedMatch();
  updatePriceBreakdown();
}

function formatMatchDate(date) {
  if (!date) return "Fixture date TBA";
  const parsedDate = new Date(date);
  if (Number.isNaN(parsedDate.getTime())) return "Fixture date TBA";
  return parsedDate.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short"
  });
}

function renderMatches() {
  const visibleMatches = matches.filter(match =>
    !activeTeamFilter || match.home === activeTeamFilter || match.away === activeTeamFilter
  );

  if (!visibleMatches.length) {
    matchGrid.innerHTML = '<p class="empty-match-result">No matchups found for this team.</p>';
    return;
  }

  matchGrid.innerHTML = visibleMatches.map((match, index) => {
    const home = getTeam(match.home);
    const away = getTeam(match.away);
    const matchNumber = String(match.matchNumber || index + 1).padStart(2, "0");

    return `
      <article class="match-card">
        <div class="match-card-head">
          <span class="match-number">${escapeHtml(match.title || "MATCH")} <b>${matchNumber}</b></span>
          <span class="demo-status"><span class="live-dot"></span> ${escapeHtml(match.status.toUpperCase())}</span>
        </div>
        <div class="match-versus">
          <div class="match-team">
            ${getTeamLogo(home)}
            <h3>${escapeHtml(home.name)}</h3>
            <span class="match-short">${escapeHtml(home.short)}</span>
          </div>
          <span class="versus-divider"><span>VS</span></span>
          <div class="match-team">
            ${getTeamLogo(away)}
            <h3>${escapeHtml(away.name)}</h3>
            <span class="match-short">${escapeHtml(away.short)}</span>
          </div>
        </div>
        <div class="match-details">
          <div><span class="detail-icon" aria-hidden="true">◷</span><span><strong>${escapeHtml(formatMatchDate(match.matchDate))}</strong><small>${escapeHtml(match.status)}</small></span></div>
          <div><span class="detail-icon" aria-hidden="true">⌖</span><span><strong>${escapeHtml(match.venue)}</strong><small>${escapeHtml(match.city)}</small></span></div>
        </div>
        <div class="match-card-bottom">
          <span class="match-placeholder">Read-only schedule · Demo booking only</span>
          <button class="button button-small" type="button" data-book-match="${escapeHtml(match.id)}">Book Tickets <span aria-hidden="true">↗</span></button>
        </div>
      </article>
    `;
  }).join("");

  attachLogoFallbacks(matchGrid);
}

function populateMatchSelect() {
  matchSelect.innerHTML = matches.map(match => {
    const home = getTeam(match.home);
    const away = getTeam(match.away);
    return `<option value="${escapeHtml(match.id)}">${escapeHtml(home.name)} vs ${escapeHtml(away.name)}</option>`;
  }).join("");

  if (!matches.length) {
    matchSelect.innerHTML = '<option value="" selected disabled>No matches are available</option>';
  }
}

function populateTicketCategories() {
  const match = getSelectedMatch();
  const categories = match
    ? match.categories.filter(category => category.availableSeats === null || category.availableSeats > 0)
    : [];
  ticketType.replaceChildren();

  if (!categories.length) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = "No ticket categories available";
    option.disabled = true;
    option.selected = true;
    ticketType.append(option);
    ticketType.disabled = true;
    return;
  }

  ticketType.disabled = false;
  categories.forEach(category => {
    const option = document.createElement("option");
    option.value = category.id;
    const availability = category.availableSeats === null ? "" : ` · ${category.availableSeats} available`;
    option.textContent = `${category.name} · ${formatRupees(category.price)}${availability}`;
    ticketType.append(option);
  });
}

function getSelectedMatch() {
  return matches.find(match => match.id === matchSelect.value);
}

function renderSelectedMatch() {
  const match = getSelectedMatch();
  const preview = document.getElementById("selectedMatchPreview");

  if (!match) {
    preview.textContent = "Choose a matchup to see the demo details.";
    return;
  }

  const home = getTeam(match.home);
  const away = getTeam(match.away);
  preview.innerHTML = `
    <div class="preview-teams">
      <div>${getTeamLogo(home, "team-mark-small")}<span>${escapeHtml(home.short)}</span></div>
      <span class="preview-vs">VS</span>
      <div>${getTeamLogo(away, "team-mark-small")}<span>${escapeHtml(away.short)}</span></div>
    </div>
    <div class="preview-venue"><span aria-hidden="true">⌖</span> ${escapeHtml(match.venue)}, ${escapeHtml(match.city)}</div>
    <span class="preview-date">${escapeHtml(formatMatchDate(match.matchDate))}</span>
  `;
  attachLogoFallbacks(preview);
}

function updatePriceBreakdown(showNotification = false) {
  const match = getSelectedMatch();
  const category = match && match.categories.find(item => item.id === ticketType.value);
  const price = category ? category.price : 0;
  const enteredQuantity = Number(quantityInput.value);
  const quantity = Number.isFinite(enteredQuantity) && enteredQuantity > 0 ? enteredQuantity : 0;
  const subtotal = price * quantity;
  const fee = Math.round(subtotal * feeRate);

  summaryMatch.textContent = match
    ? `${getTeam(match.home).name} vs ${getTeam(match.away).name}`
    : "Choose a matchup";
  summaryCategory.textContent = category ? category.name : "Choose a stand";
  summaryQuantity.textContent = String(quantity);
  pricePerTicket.textContent = category ? formatRupees(price) : "—";
  document.getElementById("ticketSubtotal").textContent = formatRupees(subtotal);
  document.getElementById("serviceFee").textContent = formatRupees(fee);
  document.getElementById("totalPrice").textContent = formatRupees(subtotal + fee);

  if (showNotification) {
    showToast("Booking summary updated.");
  }
}

function showMatchFilter(teamShort) {
  activeTeamFilter = teamShort;
  matchTeamFilter.value = teamShort;
  const team = getTeam(teamShort);
  const matchFilter = document.getElementById("matchFilter");
  matchFilter.hidden = false;
  document.getElementById("matchFilterLabel").textContent = `Matchups featuring ${team.name}`;

  const firstMatch = matches.find(match => match.home === teamShort || match.away === teamShort);
  if (firstMatch) {
    matchSelect.value = firstMatch.id;
    populateTicketCategories();
    renderSelectedMatch();
    updatePriceBreakdown(true);
  }

  renderMatches();
  document.getElementById("matches").scrollIntoView({ behavior: "smooth" });
}

function goToBooking(matchId) {
  const match = matches.find(item => item.id === matchId);
  if (match) {
    matchSelect.value = match.id;
    populateTicketCategories();
    renderSelectedMatch();
    updatePriceBreakdown();
  }
  document.getElementById("booking").scrollIntoView({ behavior: "smooth" });
  showToast("Your matchup is selected. Complete the booking form below.");
}

function setBookingMessage(message, type = "") {
  bookingMessage.textContent = message;
  bookingMessage.className = `form-message${type ? ` is-${type}` : ""}`;
}

function addReviewRow(label, value, isTotal = false) {
  const row = document.createElement("div");
  row.className = `review-row${isTotal ? " review-row-total" : ""}`;
  const labelElement = document.createElement(isTotal ? "strong" : "span");
  const valueElement = document.createElement("strong");
  labelElement.textContent = label;
  valueElement.textContent = value;
  row.append(labelElement, valueElement);
  reviewSummary.append(row);
}

function openBookingReview() {
  const match = getSelectedMatch();
  const category = match && match.categories.find(item => item.id === ticketType.value);
  if (!match || !category) {
    setBookingMessage("Please choose a match and an available ticket category before continuing.", "error");
    return;
  }

  const home = getTeam(match.home);
  const away = getTeam(match.away);
  const subtotal = category.price * Number(quantityInput.value);
  const fee = Math.round(subtotal * feeRate);

  pendingBooking = {
    id: `IPL-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
    matchId: match.id,
    categoryId: category.id,
    name: document.getElementById("customerName").value.trim(),
    email: document.getElementById("customerEmail").value.trim(),
    home: home.name,
    away: away.name,
    homeShort: home.short,
    awayShort: away.short,
    venue: match.venue,
    city: match.city,
    date: formatMatchDate(match.matchDate),
    category: category.name,
    quantity: Number(quantityInput.value),
    subtotal,
    fee,
    total: subtotal + fee,
    createdAt: new Date().toISOString()
  };

  reviewSummary.replaceChildren();
  const dialogMessage = document.getElementById("bookingDialogMessage");
  dialogMessage.textContent = "";
  dialogMessage.className = "form-message";
  addReviewRow("Matchup", `${home.name} vs ${away.name}`);
  addReviewRow("Venue · demo", `${match.venue}, ${match.city}`);
  addReviewRow("Schedule", formatMatchDate(match.matchDate));
  addReviewRow("Tickets", `${pendingBooking.quantity} × ${category.name}`);
  addReviewRow("Ticket subtotal", formatRupees(subtotal));
  addReviewRow("Demo service fee", formatRupees(fee));
  addReviewRow("Estimated total", formatRupees(pendingBooking.total), true);
  addReviewRow("Name", pendingBooking.name);
  addReviewRow("Email", pendingBooking.email);
  reviewDialog.showModal();
  setBookingMessage("");
}

function readSavedBookings() {
  try {
    const stored = localStorage.getItem(bookingStorageKey);
    if (!stored) return [];

    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed)) {
      throw new TypeError("Saved booking data is not a list.");
    }

    return parsed.filter(booking => booking && typeof booking.id === "string" && typeof booking.name === "string");
  } catch (error) {
    console.error("Could not read locally saved demo bookings.", error);
    storageMessage.textContent = "Saved demo bookings could not be read from this browser. Check your browser storage settings.";
    storageMessage.classList.add("is-error");
    return [];
  }
}

function createBookingElement(booking) {
  const card = document.createElement("article");
  card.className = "saved-booking";

  const header = document.createElement("div");
  header.className = "saved-booking-head";
  const id = document.createElement("span");
  id.className = "saved-booking-id";
  id.textContent = `DEMO PREVIEW · ${booking.id}`;
  const removeButton = document.createElement("button");
  removeButton.className = "remove-booking";
  removeButton.type = "button";
  removeButton.dataset.removeBooking = booking.id;
  removeButton.setAttribute("aria-label", `Remove demo booking ${booking.id}`);
  removeButton.textContent = "Hide";
  header.append(id, removeButton);

  const teamsLine = document.createElement("h3");
  teamsLine.textContent = `${booking.home} vs ${booking.away}`;
  const detail = document.createElement("p");
  detail.textContent = `${booking.venue}, ${booking.city} · ${booking.date}`;
  const customer = document.createElement("p");
  customer.className = "saved-booking-customer";
  customer.textContent = `${booking.name} · ${booking.email}`;

  const footer = document.createElement("div");
  footer.className = "saved-booking-footer";
  const tickets = document.createElement("span");
  tickets.textContent = `${booking.quantity} × ${booking.category}`;
  const total = document.createElement("strong");
  total.textContent = `Estimated total ${formatRupees(booking.total)}`;
  footer.append(tickets, total);
  const notice = document.createElement("p");
  notice.className = "saved-booking-notice";
  notice.textContent = "Saved in Supabase · Demo availability updated · No real tickets issued";
  card.append(header, teamsLine, detail, customer, footer, notice);
  return card;
}

function renderSavedBookings() {
  const list = document.getElementById("bookingsList");
  const empty = document.getElementById("bookingsEmpty");
  list.replaceChildren(...savedBookings.map(createBookingElement));
  empty.hidden = savedBookings.length > 0;
  list.hidden = savedBookings.length === 0;
}

async function savePendingBooking() {
  if (!pendingBooking) {
    setBookingMessage("There is no booking to save. Please review your booking again.", "error");
    reviewDialog.close();
    return;
  }

  const booking = pendingBooking;
  const saveButton = document.getElementById("saveBookingButton");
  saveButton.disabled = true;
  try {
    if (!supabaseClient) {
      throw new Error("Supabase is not configured. Add the project URL and publishable key to .env, then restart the app.");
    }

    const { data, error } = await supabaseClient.rpc("create_ticket_booking", {
      p_booking_reference: booking.id,
      p_match_id: String(booking.matchId),
      p_ticket_category_id: String(booking.categoryId),
      p_customer_name: booking.name,
      p_customer_email: booking.email,
      p_quantity: booking.quantity
    });
    if (error) throw error;
    if (!data || data.booking_reference !== booking.id) {
      throw new Error("Supabase returned an invalid booking confirmation.");
    }

    const nextBookings = [booking, ...savedBookings];
    savedBookings = nextBookings;
    renderSavedBookings();
    reviewDialog.close();
    bookingForm.reset();
    populateTicketCategories();
    renderSelectedMatch();
    updatePriceBreakdown();
    try {
      localStorage.setItem(bookingStorageKey, JSON.stringify(nextBookings));
      storageMessage.classList.remove("is-error");
      storageMessage.textContent = "Your demo booking is saved in this browser and Supabase.";
    } catch (storageError) {
      console.error("Booking was submitted to Supabase, but could not be saved in browser storage.", storageError);
      storageMessage.classList.add("is-error");
      storageMessage.textContent = "Booking saved to Supabase, but could not be saved in this browser.";
    }
    setBookingMessage(`Demo booking ${booking.id} was saved to Supabase. Demo availability was updated; no real tickets were issued.`, "success");
    pendingBooking = null;
    document.getElementById("my-bookings").scrollIntoView({ behavior: "smooth" });
  } catch (error) {
    console.error("Could not save the demo booking to Supabase.", error);
    const message = `Could not save this booking to Supabase: ${error.message}`;
    setBookingMessage(message, "error");
    const dialogMessage = document.getElementById("bookingDialogMessage");
    dialogMessage.textContent = message;
    dialogMessage.className = "form-message is-error";
  } finally {
    saveButton.disabled = false;
  }
}

function removeSavedBooking(id) {
  const nextBookings = savedBookings.filter(booking => booking.id !== id);
  try {
    if (nextBookings.length) {
      localStorage.setItem(bookingStorageKey, JSON.stringify(nextBookings));
    } else {
      localStorage.removeItem(bookingStorageKey);
    }
    savedBookings = nextBookings;
    renderSavedBookings();
    storageMessage.classList.remove("is-error");
    storageMessage.textContent = "Demo booking removed from this browser.";
  } catch (error) {
    console.error("Could not remove the saved demo booking from browser storage.", error);
    storageMessage.textContent = "Could not remove this booking from browser storage. Try again.";
    storageMessage.classList.add("is-error");
  }
}

function setActiveNavigation() {
  const sections = document.querySelectorAll("main section[id]");
  const navLinks = document.querySelectorAll(".primary-nav a");

  if (!("IntersectionObserver" in window)) return;

  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      navLinks.forEach(link => {
        const isCurrent = link.getAttribute("href") === `#${entry.target.id}`;
        if (isCurrent) link.setAttribute("aria-current", "location");
        else link.removeAttribute("aria-current");
      });
    });
  }, { rootMargin: "-30% 0px -60% 0px" });

  sections.forEach(section => observer.observe(section));
}

function initializeNavigation() {
  const menuToggle = document.getElementById("menuToggle");
  const primaryNav = document.getElementById("primaryNav");

  const closeMenu = () => {
    const wasOpen = menuToggle.getAttribute("aria-expanded") === "true";
    primaryNav.classList.remove("is-open");
    menuToggle.setAttribute("aria-expanded", "false");
    menuToggle.setAttribute("aria-label", "Open navigation menu");
    return wasOpen;
  };

  menuToggle.addEventListener("click", () => {
    const isOpen = menuToggle.getAttribute("aria-expanded") === "true";
    menuToggle.setAttribute("aria-expanded", String(!isOpen));
    menuToggle.setAttribute("aria-label", isOpen ? "Open navigation menu" : "Close navigation menu");
    primaryNav.classList.toggle("is-open", !isOpen);
  });

  primaryNav.addEventListener("click", event => {
    if (!event.target.closest("a")) return;
    closeMenu();
  });

  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && closeMenu()) {
      menuToggle.focus();
    }
  });

  window.matchMedia("(min-width: 881px)").addEventListener("change", closeMenu);
  setActiveNavigation();
}

teamsGrid.addEventListener("click", event => {
  const button = event.target.closest("[data-team]");
  if (button) showMatchFilter(button.dataset.team);
});

matchGrid.addEventListener("click", event => {
  const button = event.target.closest("[data-book-match]");
  if (button) goToBooking(button.dataset.bookMatch);
});

document.querySelectorAll('a[href="#booking"]').forEach(link => {
  link.addEventListener("click", () => {
    showToast("Opening the booking form.");
  });
});

document.getElementById("clearMatchFilter").addEventListener("click", () => {
  activeTeamFilter = "";
  matchTeamFilter.value = "";
  document.getElementById("matchFilter").hidden = true;
  renderMatches();
});

matchTeamFilter.addEventListener("change", () => {
  activeTeamFilter = matchTeamFilter.value;
  const matchFilter = document.getElementById("matchFilter");
  matchFilter.hidden = !activeTeamFilter;
  if (activeTeamFilter) {
    document.getElementById("matchFilterLabel").textContent =
      `Matchups featuring ${getTeam(activeTeamFilter).name}`;
  }
  renderMatches();
});

document.querySelectorAll("[data-match-view]").forEach(button => {
  button.addEventListener("click", () => {
    const view = button.dataset.matchView;
    matchGrid.classList.toggle("is-list", view === "list");
    document.querySelectorAll("[data-match-view]").forEach(viewButton => {
      viewButton.setAttribute("aria-pressed", String(viewButton === button));
    });
  });
});

matchSelect.addEventListener("change", () => {
  populateTicketCategories();
  renderSelectedMatch();
  updatePriceBreakdown(true);
});
ticketType.addEventListener("change", () => updatePriceBreakdown(true));
quantityInput.addEventListener("input", () => updatePriceBreakdown(true));
quantityInput.addEventListener("change", () => updatePriceBreakdown());

bookingForm.addEventListener("submit", event => {
  event.preventDefault();
  if (!bookingForm.reportValidity()) return;
  openBookingReview();
});

document.getElementById("saveBookingButton").addEventListener("click", () => {
  savePendingBooking();
});
reviewDialog.querySelectorAll("[data-close-review]").forEach(button => {
  button.addEventListener("click", () => reviewDialog.close());
});
reviewDialog.addEventListener("click", event => {
  if (event.target === reviewDialog) reviewDialog.close();
});
reviewDialog.addEventListener("close", () => {
  pendingBooking = null;
});

document.getElementById("bookingsList").addEventListener("click", event => {
  const button = event.target.closest("[data-remove-booking]");
  if (button) removeSavedBooking(button.dataset.removeBooking);
});

renderTeams();
renderStadiums();
renderMatches();
populateMatchSelect();
populateTicketCategories();
renderSelectedMatch();
updatePriceBreakdown();
savedBookings = readSavedBookings();
renderSavedBookings();
initializeNavigation();
loadSupabaseData().catch(error => {
  console.error("Could not load public Supabase data; showing the demo data.", error);
  const databaseMessage = document.getElementById("databaseMessage");
  databaseMessage.classList.add("is-error");
  databaseMessage.textContent = "Could not load live data from Supabase. Showing demo data instead.";
});

if (supabaseClient) {
  realtimeChannel = supabaseClient
    .channel("ipl-live-data")
    .on("postgres_changes", { event: "*", schema: "public", table: "matches" }, () => {
      loadSupabaseData().catch(error => {
        console.error("Could not refresh matches after a database change.", error);
        document.getElementById("databaseMessage").textContent =
          "A live database update could not be loaded. Refresh the page to retry.";
      });
    })
    .on("postgres_changes", { event: "*", schema: "public", table: "ticket_categories" }, () => {
      loadSupabaseData().catch(error => {
        console.error("Could not refresh ticket availability after a database change.", error);
        document.getElementById("databaseMessage").textContent =
          "A live availability update could not be loaded. Refresh the page to retry.";
      });
    })
    .subscribe(status => {
      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        console.error(`Supabase realtime subscription status: ${status}`);
        const databaseMessage = document.getElementById("databaseMessage");
        databaseMessage.classList.add("is-error");
        databaseMessage.textContent = "Live updates are unavailable. Refresh the page to see current data.";
      }
    });

  window.addEventListener("pagehide", () => {
    if (realtimeChannel) supabaseClient.removeChannel(realtimeChannel);
  }, { once: true });
}
