// This array will hold our cart items (local only — no server cart for guests)
let cart = [];
let favorites = [];
let transactionHistory = [];
let userProfile = null;
let isLoggedIn = false;

// === API BASE URL ===
// In development, the Express server serves both frontend and API on the same
// origin (http://localhost:3000), so an empty string works fine.
// In production on Netlify, all /api/* requests are proxied to the serverless
// function via redirect rules in netlify.toml, so the empty string still works.
// Change to a full URL (e.g. 'https://your-api.com') if frontend and API are
// hosted on different domains.
const API_BASE = '';

// === API Service Layer ===
const api = {
    token: localStorage.getItem('authToken') || null,

    async request(method, endpoint, body = null) {
        const headers = { 'Content-Type': 'application/json' };
        if (this.token) headers['Authorization'] = `Bearer ${this.token}`;
        const res = await fetch(`${API_BASE}${endpoint}`, {
            method,
            headers,
            body: body ? JSON.stringify(body) : undefined
        });
        const data = await res.json();
        if (!res.ok) {
            throw new Error(data.error || 'Request failed');
        }
        return data;
    },

    // Auth
    register(data) { return this.request('POST', '/api/auth/register', data); },
    login(data) { return this.request('POST', '/api/auth/login', data); },
    getProfile() { return this.request('GET', '/api/auth/profile'); },
    updateProfile(data) { return this.request('PUT', '/api/auth/profile', data); },

    // Favorites
    getFavorites() { return this.request('GET', '/api/favorites'); },
    toggleFavorite(itemId) { return this.request('POST', '/api/favorites/toggle', { itemId }); },

    // Orders
    getOrders() { return this.request('GET', '/api/orders'); },
    createOrder(data) { return this.request('POST', '/api/orders', data); },
    clearOrders() { return this.request('DELETE', '/api/orders/clear'); }
};

// === Data (Dynamic Menu) ===
const menuItems = [
    // Burgers
    { id: "1", name: "Classic Burger", price: 5.99, icon: "🍔", bg: "linear-gradient(135deg, #ff914d, #ff6b81)", category: "Burgers" },
    { id: "101", name: "Double Cheeseburger", price: 8.49, icon: "🍔", bg: "linear-gradient(135deg, #e67e22, #f39c12)", category: "Burgers" },
    
    // Pizzas
    { id: "2", name: "Cheese Pizza", price: 8.99, icon: "🍕", bg: "linear-gradient(135deg, #ffbd59, #ff914d)", category: "Pizzas" },
    { id: "201", name: "Pepperoni Pizza", price: 10.99, icon: "🍕", bg: "linear-gradient(135deg, #e74c3c, #c0392b)", category: "Pizzas" },
    
    // Chicken
    { id: "301", name: "KFC Style Bucket", price: 14.99, icon: "🍗", bg: "linear-gradient(135deg, #ff4757, #e84118)", category: "Chicken" },
    { id: "302", name: "Chicken Wings", price: 6.99, icon: "🍗", bg: "linear-gradient(135deg, #fda7df, #f78fb3)", category: "Chicken" },
    
    // Sandwiches & Wraps
    { id: "401", name: "Spicy Trindwich", price: 7.99, icon: "🥪", bg: "linear-gradient(135deg, #feca57, #ff9f43)", category: "Sandwiches" },
    { id: "402", name: "Beef Lavash Wrap", price: 6.49, icon: "🌯", bg: "linear-gradient(135deg, #1dd1a1, #10ac84)", category: "Sandwiches" },
    { id: "403", name: "Chicken Shawarma", price: 5.99, icon: "🥙", bg: "linear-gradient(135deg, #5f27cd, #341f97)", category: "Sandwiches" },
    
    // Sides
    { id: "3", name: "Crispy Fries", price: 2.99, icon: "🍟", bg: "linear-gradient(135deg, #ffde59, #ffbd59)", category: "Sides" },
    { id: "501", name: "Onion Rings", price: 4.50, icon: "🧅", bg: "linear-gradient(135deg, #ffb142, #cc8e35)", category: "Sides" },
    
    // Desserts
    { id: "601", name: "Strawberry Cheesecake", price: 4.99, icon: "🍰", bg: "linear-gradient(135deg, #ff9ff3, #f368e0)", category: "Desserts" },
    { id: "602", name: "Chocolate Ice Cream", price: 3.50, icon: "🍦", bg: "linear-gradient(135deg, #a4b0be, #747d8c)", category: "Desserts" },
    { id: "603", name: "Glazed Donut", price: 2.50, icon: "🍩", bg: "linear-gradient(135deg, #ff6b6b, #ee5253)", category: "Desserts" },
    
    // Drinks
    { id: "4", name: "Cold Soda", price: 1.99, icon: "🥤", bg: "linear-gradient(135deg, #576574, #2f3542)", category: "Drinks" },
    { id: "701", name: "Iced Coffee", price: 3.99, icon: "🧋", bg: "linear-gradient(135deg, #b2bec3, #576574)", category: "Drinks" }
];
const offers = [
    { id: "5", name: "Combo Meal", price: 10.99, originalPrice: 13.99, icon: "🍔🍟🥤", bg: "linear-gradient(135deg, #ff5757, #ff3838)", badge: "20% OFF", isOffer: true }
];

// === DOM Elements ===
const cartIcon = document.getElementById("cart-icon");
const cartSidebar = document.getElementById("cart-sidebar");
const closeCartBtn = document.getElementById("close-cart");
const overlay = document.getElementById("overlay");
const cartItemsContainer = document.getElementById("cart-items");
const cartCountElement = document.getElementById("cart-count");
const bottomCartCountElement = document.getElementById("bottom-cart-count");
const cartTotalElement = document.getElementById("cart-total");
const checkoutBtn = document.getElementById("checkout-btn");

const homeSection = document.getElementById("home-section");
const profileSection = document.getElementById("profile-section");

const navHome = document.getElementById("nav-home");
const navProfile = document.getElementById("nav-profile");
const bottomNavHome = document.getElementById("bottom-nav-home");
const bottomNavProfile = document.getElementById("bottom-nav-profile");

const menuGrid = document.getElementById("menu-grid");
const offersGrid = document.getElementById("offers-grid");
const favoritesGrid = document.getElementById("favorites-grid");
const filterBtns = document.querySelectorAll(".filter-btn");

// Dark Mode Toggle Elements
const darkModeToggle = document.getElementById("dark-mode-toggle");

// Modal Details
const checkoutModal = document.getElementById("checkout-modal");
const closeModalBtn = document.getElementById("close-modal");
const confirmCheckoutBtn = document.getElementById("confirm-checkout-btn");
const checkoutForm = document.getElementById("checkout-form");

// Toast Container
const toastContainer = document.getElementById("toast-container");

// Transaction History Elements
const historyListContainer = document.getElementById("history-list");
const clearHistoryBtn = document.getElementById("clear-history-btn");

// Profile Form Elements
const editProfileBtn = document.getElementById("edit-profile-btn");
const cancelEditBtn = document.getElementById("cancel-edit-btn");
const profileDisplayCard = document.getElementById("profile-display-card");
const profileEditCard = document.getElementById("profile-edit-card");
const profileForm = document.getElementById("profile-form");

const displayName = document.getElementById("display-name");
const displayPhone = document.getElementById("display-phone");
const displayAddress = document.getElementById("display-address");
const profileWelcomeName = document.getElementById("profile-welcome-name");

const editName = document.getElementById("edit-name");
const editPhone = document.getElementById("edit-phone");
const editAddress = document.getElementById("edit-address");

// Auth Elements
const btnLogin = document.getElementById("btn-login");
const btnLogout = document.getElementById("btn-logout");
const userMenu = document.getElementById("user-menu");
const userNameDisplay = document.getElementById("user-name-display");
const guestPlaceholder = document.getElementById("profile-guest-placeholder");
const authenticatedContent = document.getElementById("profile-authenticated-content");
const guestLoginBtn = document.getElementById("guest-login-btn");

// Auth Modals
const loginModal = document.getElementById("login-modal");
const registerModal = document.getElementById("register-modal");
const closeLoginModal = document.getElementById("close-login-modal");
const closeRegisterModal = document.getElementById("close-register-modal");
const loginForm = document.getElementById("login-form");
const registerForm = document.getElementById("register-form");
const switchToRegister = document.getElementById("switch-to-register");
const switchToLogin = document.getElementById("switch-to-login");
const loginSubmitBtn = document.getElementById("login-submit-btn");
const registerSubmitBtn = document.getElementById("register-submit-btn");

// === Dark Mode Logic ===
if (localStorage.getItem("theme") === "dark") {
    document.documentElement.setAttribute("data-theme", "dark");
}
darkModeToggle.addEventListener("click", () => {
    let currentTheme = document.documentElement.getAttribute("data-theme");
    if (currentTheme === "dark") {
        document.documentElement.setAttribute("data-theme", "light");
        localStorage.setItem("theme", "light");
    } else {
        document.documentElement.setAttribute("data-theme", "dark");
        localStorage.setItem("theme", "dark");
    }
});

// === Toast Logic ===
function showToast(message, type = "success") {
    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    toast.textContent = message;
    
    toastContainer.appendChild(toast);
    
    // Trigger animation
    setTimeout(() => toast.classList.add("show"), 10);
    
    // Remove after 3 seconds
    setTimeout(() => {
        toast.classList.remove("show");
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// === Auth State Management ===
function setLoggedInState(token, user) {
    isLoggedIn = true;
    api.token = token;
    userProfile = user;
    localStorage.setItem('authToken', token);
    updateAuthUI();
}

function setLoggedOutState() {
    isLoggedIn = false;
    api.token = null;
    userProfile = null;
    favorites = [];
    transactionHistory = [];
    localStorage.removeItem('authToken');
    updateAuthUI();
}

function updateAuthUI() {
    if (isLoggedIn && userProfile) {
        btnLogin.style.display = 'none';
        userMenu.style.display = 'flex';
        userNameDisplay.textContent = userProfile.name;
        profileWelcomeName.textContent = userProfile.name;
    } else {
        btnLogin.style.display = 'block';
        userMenu.style.display = 'none';
        userNameDisplay.textContent = 'User';
        profileWelcomeName.textContent = 'Foodie';
    }
}

function showGuestProfile() {
    guestPlaceholder.style.display = 'block';
    authenticatedContent.style.display = 'none';
}

function showAuthenticatedProfile() {
    guestPlaceholder.style.display = 'none';
    authenticatedContent.style.display = 'block';
}

// === Auth: Try to restore session on page load ===
async function tryRestoreSession() {
    const token = localStorage.getItem('authToken');
    if (!token) {
        setLoggedOutState();
        return;
    }

    try {
        const profileRes = await api.getProfile();
        const user = profileRes.user;
        
        // Load favorites
        try {
            const favRes = await api.getFavorites();
            favorites = favRes.favorites;
        } catch (e) {
            favorites = [];
        }

        // Load orders
        try {
            const ordersRes = await api.getOrders();
            transactionHistory = ordersRes.orders;
        } catch (e) {
            transactionHistory = [];
        }

        setLoggedInState(token, user);
        renderProfile();
        renderFavorites();
        renderHistory();
        showToast(`Welcome back, ${user.name}! 🍔`, 'success');
    } catch (err) {
        console.warn('Session restore failed:', err);
        setLoggedOutState();
    }
}

// === Auth: Login ===
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;

    loginSubmitBtn.textContent = '⏳ Logging in...';
    loginSubmitBtn.disabled = true;

    try {
        const res = await api.login({ email, password });
        const user = res.user;

        // Load user data
        favorites = [];
        transactionHistory = [];
        try {
            const favRes = await api.getFavorites();
            favorites = favRes.favorites;
        } catch (e) { /* ignore */ }
        try {
            const ordersRes = await api.getOrders();
            transactionHistory = ordersRes.orders;
        } catch (e) { /* ignore */ }

        setLoggedInState(res.token, user);
        closeModal(loginModal);
        loginForm.reset();
        showHome();
        renderProfile();
        renderFavorites();
        renderHistory();
        showToast(`Welcome, ${user.name}! 🍔`, 'success');
    } catch (err) {
        showToast(err.message || 'Login failed', 'error');
    } finally {
        loginSubmitBtn.textContent = 'Log In';
        loginSubmitBtn.disabled = false;
    }
});

// === Auth: Register ===
registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('reg-name').value.trim();
    const email = document.getElementById('reg-email').value.trim();
    const phone = document.getElementById('reg-phone').value.trim();
    const password = document.getElementById('reg-password').value;

    if (password.length < 6) {
        showToast('Password must be at least 6 characters', 'error');
        return;
    }

    registerSubmitBtn.textContent = '⏳ Creating account...';
    registerSubmitBtn.disabled = true;

    try {
        const res = await api.register({ name, email, phone, password });
        const user = res.user;

        favorites = [];
        transactionHistory = [];

        setLoggedInState(res.token, user);
        closeModal(registerModal);
        registerForm.reset();
        showHome();
        renderProfile();
        renderFavorites();
        renderHistory();
        showToast(`Account created! Welcome, ${user.name}! 🎉`, 'success');
    } catch (err) {
        showToast(err.message || 'Registration failed', 'error');
    } finally {
        registerSubmitBtn.textContent = 'Create Account';
        registerSubmitBtn.disabled = false;
    }
});

// === Auth: Logout ===
btnLogout.addEventListener('click', () => {
    setLoggedOutState();
    cart = [];
    updateCartUI();
    showHome();
    renderProfile();
    renderFavorites();
    renderHistory();
    showToast('Logged out successfully 👋', 'success');
});

// === Auth: Modal Switching ===
function openModal(modal) {
    modal.classList.add('show');
    overlay.classList.add('show');
}

function closeModal(modal) {
    modal.classList.remove('show');
    overlay.classList.remove('show');
}

btnLogin.addEventListener('click', () => openModal(loginModal));
guestLoginBtn.addEventListener('click', () => openModal(loginModal));

closeLoginModal.addEventListener('click', () => closeModal(loginModal));
closeRegisterModal.addEventListener('click', () => closeModal(registerModal));

switchToRegister.addEventListener('click', (e) => {
    e.preventDefault();
    closeModal(loginModal);
    openModal(registerModal);
});

switchToLogin.addEventListener('click', (e) => {
    e.preventDefault();
    closeModal(registerModal);
    openModal(loginModal);
});

// Close auth modals when clicking overlay
overlay.addEventListener('click', () => {
    closeModal(loginModal);
    closeModal(registerModal);
});

// === Initialization & Rendering ===
function renderCards(items, container) {
    if(!container) return;
    container.innerHTML = "";
    if (items.length === 0 && container.id !== "offers-grid") {
        container.innerHTML = "<p>No items found.</p>";
        return;
    }
    
    items.forEach(item => {
        const isFav = favorites.includes(item.id);
        const card = document.createElement("div");
        card.className = item.isOffer ? "card offer-card" : "card";
        card.setAttribute("data-id", item.id);
        card.setAttribute("data-name", item.name);
        card.setAttribute("data-price", item.price);
        
        let priceHTML = `<p class="price">$${item.price.toFixed(2)}</p>`;
        if (item.isOffer) {
            priceHTML = `<p class="price"><strike>$${item.originalPrice.toFixed(2)}</strike> $${item.price.toFixed(2)}</p>`;
        }
        
        card.innerHTML = `
            <button class="fav-btn ${isFav ? 'active' : ''}" onclick="toggleFavorite(event, '${item.id}')">❤️</button>
            <div class="card-img" style="background: ${item.bg};">${item.icon}</div>
            <h3>${item.name} ${item.badge ? `<span class="badge">${item.badge}</span>` : ""}</h3>
            ${priceHTML}
            <button class="add-to-cart">Add to Cart</button>
        `;
        container.appendChild(card);
    });
    
    // Re-attach add to cart listeners dynamically
    attachAddToCartListeners(container);
}

function initMenu() {
    renderCards(offers, offersGrid);
    renderCards(menuItems, menuGrid);
    renderFavorites();
    renderProfile();
    renderHistory();
}

// === Auth-Protected Favorites Toggle ===
window.toggleFavorite = async function(e, itemId) {
    e.stopPropagation();
    const btn = e.currentTarget;

    if (!isLoggedIn) {
        showToast('Please log in to save favorites! ❤️', 'error');
        openModal(loginModal);
        return;
    }

    try {
        const res = await api.toggleFavorite(itemId);

        if (res.favorited) {
            if (!favorites.includes(itemId)) favorites.push(itemId);
            btn.classList.add('active');
            showToast('Added to Favorites! ❤️', 'success');
        } else {
            favorites = favorites.filter(f => f !== itemId);
            btn.classList.remove('active');
            showToast('Removed from Favorites!', 'success');
        }

        renderFavorites();
        // Re-render current menu to update heart states
        const activeFilter = document.querySelector('.filter-btn.active');
        if (activeFilter) {
            const filter = activeFilter.getAttribute('data-filter');
            if (filter === 'All') {
                renderCards(menuItems, menuGrid);
            } else {
                renderCards(menuItems.filter(m => m.category === filter), menuGrid);
            }
        }
    } catch (err) {
        showToast(err.message || 'Failed to toggle favorite', 'error');
    }
};

function renderFavorites() {
    if (!favoritesGrid) return;
    const favItems = [...menuItems, ...offers].filter(item => favorites.includes(item.id));
    
    if (favItems.length === 0) {
        favoritesGrid.innerHTML = `<p class="empty-history-msg" style="grid-column: 1 / -1;">No favorites yet. Click the ❤️ on a menu item to save it here!</p>`;
    } else {
        renderCards(favItems, favoritesGrid);
    }
}

// === Filter Logic ===
filterBtns.forEach(btn => {
    btn.addEventListener("click", (e) => {
        filterBtns.forEach(b => b.classList.remove("active"));
        e.target.classList.add("active");
        
        const filter = e.target.getAttribute("data-filter");
        if (filter === "All") {
            renderCards(menuItems, menuGrid);
        } else {
            const filtered = menuItems.filter(item => item.category === filter);
            renderCards(filtered, menuGrid);
        }
    });
});

// === Navigation Logic ===
function showHome(e) {
    if (e) e.preventDefault();
    homeSection.style.display = "block";
    profileSection.style.display = "none";
    if(bottomNavHome) bottomNavHome.classList.add("active");
    if(bottomNavProfile) bottomNavProfile.classList.remove("active");
}

function showProfile(e) {
    if (e) e.preventDefault();
    homeSection.style.display = "none";
    profileSection.style.display = "block";
    if(bottomNavHome) bottomNavHome.classList.remove("active");
    if(bottomNavProfile) bottomNavProfile.classList.add("active");
    
    if (isLoggedIn) {
        renderProfile();
        renderFavorites();
        renderHistory();
    } else {
        showGuestProfile();
    }
}

if (navHome) navHome.addEventListener("click", showHome);
if (navProfile) navProfile.addEventListener("click", showProfile);
if (bottomNavHome) bottomNavHome.addEventListener("click", showHome);
if (bottomNavProfile) bottomNavProfile.addEventListener("click", showProfile);

// === Event Listeners for Cart Opening/Closing ===
cartIcon.addEventListener("click", openCart);
closeCartBtn.addEventListener("click", closeCart);
overlay.addEventListener("click", (e) => {
    // Only close cart/checkout if the overlay was clicked directly (not auth modal)
    closeCart();
});

function openCart(e) {
    if(e) e.preventDefault();
    cartSidebar.classList.add("open");
    overlay.classList.add("show");
}

function closeCart() {
    cartSidebar.classList.remove("open");
    overlay.classList.remove("show");
    checkoutModal.classList.remove("show");
}

// === Add to Cart Logic ===
function attachAddToCartListeners(container) {
    const buttons = container.querySelectorAll(".add-to-cart");
    buttons.forEach(button => {
        button.addEventListener("click", (e) => {
            const card = e.target.closest('.card');
            const id = card.getAttribute('data-id');
            const name = card.getAttribute('data-name');
            const price = parseFloat(card.getAttribute('data-price'));
            
            addItemToCart(id, name, price);
            
            // Show a quick visual feedback
            button.textContent = "Added!";
            button.style.backgroundColor = "#4caf50";
            showToast(`${name} added to cart!`);
            
            setTimeout(() => {
                button.textContent = "Add to Cart";
                button.style.backgroundColor = "";
            }, 1000);
        });
    });
}

function addItemToCart(id, name, price) {
    const existingItem = cart.find(item => item.id === id);
    
    if (existingItem) {
        existingItem.quantity += 1;
    } else {
        cart.push({ id, name, price, quantity: 1 });
    }
    
    updateCartUI();
}

// === Update UI (Cart HTML, Totals, Badges) ===
function updateCartUI() {
    const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
    cartCountElement.textContent = totalItems;
    if (bottomCartCountElement) {
        bottomCartCountElement.textContent = totalItems;
    }
    
    cartItemsContainer.innerHTML = '';
    
    if (cart.length === 0) {
        cartItemsContainer.innerHTML = '<p class="empty-cart-msg">Your cart is empty.</p>';
    } else {
        cart.forEach(item => {
            const itemElement = document.createElement('div');
            itemElement.classList.add('cart-item');
            
            itemElement.innerHTML = `
                <div class="cart-item-info">
                    <h4>${item.name}</h4>
                    <p>$${item.price.toFixed(2)}</p>
                    <div class="quantity-controls">
                        <button class="qty-btn" onclick="updateQuantity('${item.id}', -1)">-</button>
                        <span>${item.quantity}</span>
                        <button class="qty-btn" onclick="updateQuantity('${item.id}', 1)">+</button>
                    </div>
                </div>
                <button class="remove-btn" onclick="removeItem('${item.id}')">Remove</button>
            `;
            
            cartItemsContainer.appendChild(itemElement);
        });
    }
    
    const totalPrice = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    cartTotalElement.textContent = totalPrice.toFixed(2);
}

// === Remove Item Logic ===
window.removeItem = function(id) {
    cart = cart.filter(item => item.id !== id);
    updateCartUI();
}

window.updateQuantity = function(id, change) {
    const item = cart.find(item => item.id === id);
    if (!item) return;
    
    item.quantity += change;
    
    if (item.quantity <= 0) {
        removeItem(id);
    } else {
        updateCartUI();
    }
}

// === Checkout & Modal Logic ===
checkoutBtn.addEventListener("click", () => {
    if (cart.length === 0) {
        showToast("Your cart is empty!", "error");
        return;
    }
    
    if (!isLoggedIn) {
        showToast("Please log in to place an order!", "error");
        openModal(loginModal);
        return;
    }
    
    // Pre-fill checkout form with profile data
    if (userProfile) {
        document.getElementById("cx-name").value = userProfile.name || '';
        document.getElementById("cx-phone").value = userProfile.phone || '';
        document.getElementById("cx-address").value = userProfile.address || '';
    }
    
    checkoutModal.classList.add("show");
    overlay.classList.add("show");
});

closeModalBtn.addEventListener("click", () => {
    checkoutModal.classList.remove("show");
});

checkoutForm.addEventListener("submit", sendOrderToServer);

// === History Rendering ===
function renderHistory() {
    if (!isLoggedIn || transactionHistory.length === 0) {
        historyListContainer.innerHTML = '<p class="empty-history-msg" style="text-align: center; color: #a4b0be; padding: 2rem;">No past orders found. Time to grab a bite! 🍔</p>';
        if(clearHistoryBtn) clearHistoryBtn.style.display = "none";
        return;
    }

    if(clearHistoryBtn) clearHistoryBtn.style.display = "block";
    historyListContainer.innerHTML = '';
    
    [...transactionHistory].reverse().forEach(order => {
        const orderDiv = document.createElement("div");
        orderDiv.classList.add("history-item");
        
        const dateObj = new Date(order.created_at);
        const dateStr = dateObj.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
        const timeStr = dateObj.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
        
        let itemsHtml = order.items.map(i => `<div><span style="font-weight:600;">${i.quantity}x</span> ${i.name}</div>`).join('');
        const addressHtml = order.address ? `<div class="history-address">📍 ${order.address}</div>` : "";
        
        orderDiv.innerHTML = `
            <div class="history-header">
                <div class="history-date">🕒 ${dateStr} at ${timeStr}</div>
                <div class="history-status">${order.status || 'Completed'}</div>
            </div>
            <div class="history-body">
                <div class="history-items-list">
                    ${itemsHtml}
                    ${addressHtml}
                </div>
                <div class="history-total">
                    $${order.total.toFixed(2)}
                </div>
            </div>
        `;
        historyListContainer.appendChild(orderDiv);
    });
}

if (clearHistoryBtn) {
    clearHistoryBtn.addEventListener("click", async () => {
        if (!isLoggedIn) return;
        if(confirm("Are you sure you want to clear all your past orders?")) {
            try {
                await api.clearOrders();
                transactionHistory = [];
                renderHistory();
                showToast("History cleared.", "success");
            } catch (err) {
                showToast(err.message || 'Failed to clear history', 'error');
            }
        }
    });
}

// === Profile Editing ===
function renderProfile() {
    if (!isLoggedIn || !userProfile) {
        showGuestProfile();
        return;
    }

    showAuthenticatedProfile();
    displayName.textContent = userProfile.name;
    displayPhone.textContent = userProfile.phone || '—';
    displayAddress.textContent = userProfile.address || '—';
    profileWelcomeName.textContent = userProfile.name;
}

editProfileBtn.addEventListener("click", () => {
    editName.value = userProfile.name;
    editPhone.value = userProfile.phone || '';
    editAddress.value = userProfile.address || '';
    
    profileDisplayCard.style.display = "none";
    profileEditCard.style.display = "flex";
    editProfileBtn.style.display = "none";
});

cancelEditBtn.addEventListener("click", () => {
    profileDisplayCard.style.display = "flex";
    profileEditCard.style.display = "none";
    editProfileBtn.style.display = "block";
});

profileForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    
    try {
        const res = await api.updateProfile({
            name: editName.value,
            phone: editPhone.value,
            address: editAddress.value
        });
        
        userProfile = res.user;
        localStorage.setItem('authToken', api.token); // ensure token is saved
        renderProfile();
        updateAuthUI();
        
        profileDisplayCard.style.display = "flex";
        profileEditCard.style.display = "none";
        editProfileBtn.style.display = "block";
        
        showToast("Profile Updated Successfully! 👤");
    } catch (err) {
        showToast(err.message || 'Failed to update profile', 'error');
    }
});

// === Send Order to Server (instead of directly to Telegram) ===
async function sendOrderToServer(e) {
    e.preventDefault();
    
    if (cart.length === 0) {
        showToast("Your cart is empty!", "error");
        return;
    }

    if (!isLoggedIn) {
        showToast("Please log in to place an order!", "error");
        return;
    }
    
    const cxName = document.getElementById("cx-name").value;
    const cxPhone = document.getElementById("cx-phone").value;
    const cxAddress = document.getElementById("cx-address").value;
    const totalPrice = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

    const originalText = confirmCheckoutBtn.textContent;
    confirmCheckoutBtn.innerHTML = `⏳ Placing order...`;
    confirmCheckoutBtn.disabled = true;

    try {
        const res = await api.createOrder({
            items: cart,
            total: totalPrice,
            address: cxAddress,
            customerName: cxName,
            customerPhone: cxPhone
        });

        showToast("Order placed successfully! 🚗💨", "success");
        
        // Save to local history
        transactionHistory.push(res.order);
        
        // Clear cart & close
        cart = [];
        updateCartUI();
        checkoutModal.classList.remove("show");
        checkoutForm.reset();
        closeCart();
        renderHistory();
    } catch (err) {
        showToast(err.message || 'Failed to place order', 'error');
    } finally {
        confirmCheckoutBtn.textContent = originalText;
        confirmCheckoutBtn.disabled = false;
    }
}

// === Init ===
async function startApp() {
    initMenu();
    await tryRestoreSession();
}

startApp();

// Note: The Telegram bot token and send logic have been moved to the server (server/routes/orders.js)
// The server reads TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID from .env for security.