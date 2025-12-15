// ShopEase - Modular E-Commerce JS - FIXED VERSION

// --- State (Cleaned up and Base Currency set to INR) ---
let products = []; // {name, price, description, image, category, ...}
let cart = [];
let wishlist = JSON.parse(localStorage.getItem('wishlist')) || []; // Load wishlist from storage
let orders = [];
let addresses = [];
let user = {};
let notifications = [];
let recentlyViewed = [];
let role = 'customer';
let currency = localStorage.getItem('currency') || 'INR'; // Default to INR, load from storage
// Currency Rates based on 1 INR. (Approximate conversion rates for example)
let rates = { INR: 1, USD: 0.012, EUR: 0.011, GBP: 0.0095 }; 

// --- Hardcoded Google Sheet URL for Automatic Loading ---
const SHEETS_URL = 'https://docs.google.com/spreadsheets/d/1HXSlafhvGbIwOMDTf89TxVMbhhH4LSYhPDmF5FEe4As/edit?gid=1982934393#gid=1982934393';
let sheetUrl = SHEETS_URL; // Use the hardcoded URL

// --- DOM Elements ---
const $ = id => document.getElementById(id);

// ----------------------------------------------------------------------
// --- Google Sheet Configuration and Fetch Logic (FIXED) ---
// ----------------------------------------------------------------------

/**
 * Extracts Sheet ID and GID from a full Google Sheet URL.
 * @param {string} url The full Google Sheet URL.
 * @returns {{sheetId: string, gid: string} | null}
 */
function parseSheetUrl(url) {
    const sheetIdMatch = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
    const gidMatch = url.match(/gid=(\d+)/);
    
    if (sheetIdMatch && gidMatch) {
        return {
            sheetId: sheetIdMatch[1],
            gid: gidMatch[1]
        };
    }
    return null;
}

/**
 * Fetches and transforms product data from a public Google Sheet 
 */
async function fetchProductsFromGoogleSheet(fullUrl) {
    const config = parseSheetUrl(fullUrl);

    if (!config) {
        console.error("Invalid Google Sheet URL format. Check if the URL contains sheet ID (d/...) and GID (gid=...).");
        return [];
    }
    
    const { sheetId, gid } = config;
    console.log(`Attempting to fetch products from Google Sheet ID: ${sheetId}, GID: ${gid}...`);

    const query = encodeURIComponent("select A, B, C, D, E label A 'name', B 'price', C 'description', D 'image', E 'category'");
    const url = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:json&tq=${query}&gid=${gid}`;

    try {
        const response = await fetch(url);
        const text = await response.text();

        const jsonText = text.replace('/*O_o*/\ngoogle.visualization.Query.setResponse(', '').slice(0, -2);
        const data = JSON.parse(jsonText);

        if (!data.table || !data.table.rows) {
            throw new Error("Invalid Google Sheet data format or no data returned.");
        }

        const sheetProducts = data.table.rows
            .map(row => {
                const cells = row.c;
                
                const priceValue = cells[1] && cells[1].v !== null ? parseFloat(cells[1].v) : NaN;
                
                return {
                    name: cells[0] ? (cells[0].v || cells[0].f || 'N/A') : 'N/A', 
                    price: priceValue,                                          
                    description: cells[2] ? (cells[2].v || cells[2].f || 'No details provided.') : 'No details provided.', // Column C
                    image: cells[3] ? (cells[3].v || cells[3].f || 'placeholder.jpg') : 'placeholder.jpg', // Column D
                    category: cells[4] ? (cells[4].v || cells[4].f || 'Misc') : 'Misc' // Column E
                };
            })
            .filter(p => p.name !== 'N/A' && !isNaN(p.price) && p.price > 0); 

        console.log(`Successfully loaded ${sheetProducts.length} products from Google Sheet.`);
        return sheetProducts;

    } catch (e) {
        console.error("Failed to fetch products from Google Sheet. Check URL, sheet publication, and column structure (A: Name, B: Price (INR), C: Details, D: Image, E: Category).", e);
        return [];
    }
}

// ----------------------------------------------------------------------
// --- Utility Functions ---
// ----------------------------------------------------------------------

function reRenderAllPrices() {
    // Re-render all elements that display prices when currency changes
    renderProducts();
    renderFeaturedProducts();
    renderRecentlyViewed();
    // Only re-render modals if they are visible
    if ($('cart-modal')?.classList.contains('active')) renderCart();
    if ($('wishlist-modal')?.classList.contains('active')) renderWishlist(); // Rerender wishlist prices
    if ($('orders-modal')?.classList.contains('active')) renderOrders();
}

function saveWishlist() {
    localStorage.setItem('wishlist', JSON.stringify(wishlist));
}

// ----------------------------------------------------------------------
// --- User Management Functions (Moved to top level for accessibility) ---
// ----------------------------------------------------------------------

/**
 * Retrieves user login details from localStorage.
 * @returns {object} An object containing user data.
 */
function getLoggedInUser() {
    return {
        email: localStorage.getItem('userEmail'),
        username: localStorage.getItem('userName'),
        isLoggedIn: localStorage.getItem('isLoggedIn') === 'true'
    };
}

/**
 * Clears session and redirects user to the login page.
 * @param {Event} e The click event.
 */
function handleLogout(e) {
    if(e) e.preventDefault(); 
    // 1. Clear user data
    localStorage.removeItem('userEmail');
    localStorage.removeItem('userName');
    localStorage.removeItem('isLoggedIn');
    
    // 2. Show a notification (Assuming showNotification exists)
    // If you don't have showNotification, you can remove this line.
    if (typeof showNotification === 'function') {
        showNotification('Logged out successfully.'); 
    }
    
    // 3. Redirect back to login page
    window.location.href = 'login.html'; 
}

// ----------------------------------------------------------------------
// --- Initialization (MODIFIED for Auto-Load) ---
// ----------------------------------------------------------------------

document.addEventListener('DOMContentLoaded', async () => {
    
    // 1. Initial product load from hardcoded URL (Always runs)
    products = await fetchProductsFromGoogleSheet(sheetUrl);
    
    // 2. Setup application components after products are loaded
    
    // Navigation
    setupNavigation();

    // Product Listing
    renderProducts();
    setupProductControls();

    // Cart
    setupCart();

    // Wishlist (UPDATED to load persistence)
    setupWishlist();

    // Orders
    setupOrders();

    // Address Book
    setupAddressBook();

    // Coupons
    setupCoupons();

    // Product Q&A
    setupQA();

    // Account
    setupAccount();

    // Notifications
    setupNotifications();

    // Support
    setupSupport();

    // Recently Viewed
    renderRecentlyViewed();

    // Newsletter
    setupNewsletter();

    // Currency
    setupCurrency(); // Runs reRenderAllPrices() on change

    // Show Home by default
    showSection('home-section');
    
    // --- NEW LOGIN/LOGOUT INTEGRATION START ---
    
    // 1. Setup logout listener for the new navigation link
    // FIX: Ensure the listener targets the correct element and calls the now-global function
    const logoutBtn = $('nav-logout'); 
    if (logoutBtn) {
        logoutBtn.addEventListener('click', handleLogout); 
    }

    // 2. Display the logged-in username in the header (Username Visual)
    const user = getLoggedInUser();
    const userDisplayElement = $('user-display'); 
    
    if (user.isLoggedIn && userDisplayElement) {
        // This assumes you added the <span id="user-display"> element in Ecom.html
        userDisplayElement.textContent = `Welcome, ${user.username || 'User'}!`;
    } else if (userDisplayElement) {
        // Hide the element or show a generic message if not logged in (though Ecom.html should redirect)
        userDisplayElement.textContent = 'Guest'; 
    }
    
    // --- NEW LOGIN/LOGOUT INTEGRATION END ---
});

// --- Navigation ---
function setupNavigation() {
    $('nav-home').onclick = () => showSection('home-section');
    $('nav-products').onclick = () => showSection('products-section');
    $('nav-categories').onclick = () => showSection('products-section');
    $('nav-orders').onclick = () => showModal('orders-modal');
    $('nav-cart').onclick = () => showModal('cart-modal');
    $('nav-wishlist').onclick = () => showModal('wishlist-modal');
    $('nav-account').onclick = () => showModal('account-modal');
    $('nav-notifications').onclick = () => showModal('notifications-modal');
    // REMOVED: Redundant/Commented out logout logic here, handled by DOMContentLoaded
    // $('logout-btn').onclick = () => { /* ...logout logic... */ }; 
    $('shop-now-btn').onclick = () => showSection('products-section');
}

// --- Section/Modal Show/Hide ---
function showSection(id) {
    document.querySelectorAll('.section').forEach(s => s.style.display = 'none');
    $(id).style.display = '';
    if (id === 'home-section') renderFeaturedProducts();
    if (id === 'products-section') renderProducts();
}
function showModal(id) {
    document.querySelectorAll('.modal').forEach(m => m.classList.remove('active'));
    $(id).classList.add('active');
    $('overlay').classList.add('active');

    // Run specific rendering functions when modal is opened
    if (id === 'cart-modal') renderCart();
    if (id === 'wishlist-modal') renderWishlist();
    if (id === 'orders-modal') renderOrders();
}
document.addEventListener('click', e => {
    if (e.target.classList.contains('modal-close') || e.target.id === 'overlay') {
        document.querySelectorAll('.modal').forEach(m => m.classList.remove('active'));
        $('overlay').classList.remove('active');
    }
});

// --- Product Controls (search, sort, filter, add) ---
function setupProductControls() {
    // Populate categories in the select dropdown
    const catSelect = $('category-select');
    if (catSelect) {
        const cats = Array.from(new Set(products.map(p => p.category))).sort();
        catSelect.innerHTML = `<option value="">All Categories</option>` +
            cats.map(cat => `<option value="${cat}">${cat}</option>`).join('');
    }

    // Search, sort, and filter event listeners
    if ($('search-input')) $('search-input').oninput = renderProducts;
    if ($('sort-select')) $('sort-select').onchange = renderProducts;
    if ($('category-select')) $('category-select').onchange = renderProducts;
    if ($('filter-btn')) $('filter-btn').onclick = renderProducts;
}

// --- Product Listing (FIXED: Wishlist Icon Logic) ---
function renderProducts() {
    const grid = $('products-grid');
    if (!grid) return;
    let filtered = [...products];

    // Search filter
    const searchVal = ($('search-input')?.value || '').trim().toLowerCase();
    if (searchVal) {
        filtered = filtered.filter(p => p.name.toLowerCase().includes(searchVal));
    }

    // Category filter
    const catVal = $('category-select')?.value || '';
    if (catVal) {
        filtered = filtered.filter(p => p.category === catVal);
    }

    // Sorting
    const sortVal = $('sort-select')?.value || 'name';
    if (sortVal === 'name') {
        filtered.sort((a, b) => a.name.localeCompare(b.name));
    } else if (sortVal === 'price-low-high') {
        filtered.sort((a, b) => a.price - b.price);
    } else if (sortVal === 'price-high-low') {
        filtered.sort((a, b) => b.price - a.price);
    }

    grid.innerHTML = '';
    if (!filtered.length) {
        grid.innerHTML = '<div style="color:#888;">No products found.</div>';
        return;
    }
    filtered.forEach((p, idx) => {
        const originalIdx = products.indexOf(p);
        const convertedPrice = (p.price * (rates[currency] || 1));
        let displayPrice = currency === 'INR' ? Math.round(convertedPrice) : convertedPrice.toFixed(2);
        
        // FIX: Ensure correct classes are used for the Font Awesome icon
        const isWishlisted = wishlist.some(item => item.name === p.name);
        const heartClass = isWishlisted ? 'fa-heart is-wishlisted' : 'fa-heart-o'; // fa-heart-o is the outlined heart

        const card = document.createElement('div');
        card.className = 'product-card';
        card.innerHTML = `
            <img src="${p.image}" alt="${p.name}">
            <h2>${p.name}</h2>
            <div class="price">${currency} ${displayPrice}</div>
            <div style="font-size:0.95em;color:#888;margin-bottom:0.5rem;">${p.category || ''}</div>
            <div class="product-actions">
                <button class="add-cart-btn" data-idx="${originalIdx}"><i class="fa fa-cart-plus"></i></button>
                <button class="wishlist-btn" data-idx="${originalIdx}"><i class="fa ${heartClass}"></i></button>
                <button class="details-btn" data-idx="${originalIdx}"><i class="fa fa-eye"></i></button>
            </div>
        `;
        grid.appendChild(card);
    });

    // Add event listeners for actions
    grid.querySelectorAll('.add-cart-btn').forEach(btn => {
        btn.onclick = () => {
            const idx = parseInt(btn.getAttribute('data-idx'));
            addToCart(products[idx]);
        };
    });
    grid.querySelectorAll('.wishlist-btn').forEach(btn => {
        btn.onclick = () => {
            const idx = parseInt(btn.getAttribute('data-idx'));
            addToWishlist(products[idx]);
            // Re-render product grid to update the heart icon color
            renderProducts(); 
        };
    });
    grid.querySelectorAll('.details-btn').forEach(btn => {
        btn.onclick = () => {
            const idx = parseInt(btn.getAttribute('data-idx'));
            showProductDetails(products[idx]);
        };
    });
    updateCartCount();
}

// --- Add to cart with quantity update ---
function addToCart(product) {
    const found = cart.find(item => item.name === product.name);
    if (found) {
        found.qty = (found.qty || 1) + 1;
    } else {
        cart.push({ ...product, qty: 1 });
    }
    showNotification('Added to cart');
    updateCartCount();
}

// --- Add/Remove from Wishlist (NEW/FIXED) ---
function addToWishlist(product) {
    const existingIndex = wishlist.findIndex(item => item.name === product.name);

    if (existingIndex > -1) {
        // Already in wishlist, so remove it
        wishlist.splice(existingIndex, 1);
        showNotification(`${product.name} removed from wishlist`);
    } else {
        // Not in wishlist, so add it
        wishlist.push(product);
        showNotification(`${product.name} added to wishlist`);
    }
    saveWishlist();
    // If the modal is open, re-render it
    if ($('wishlist-modal')?.classList.contains('active')) renderWishlist(); 
}

// --- Update cart count in nav ---
function updateCartCount() {
    const count = cart.reduce((sum, item) => sum + (item.qty || 1), 0);
    const cartCountElem = $('cart-count');
    if (cartCountElem) cartCountElem.textContent = count;
}

document.addEventListener('DOMContentLoaded', updateCartCount);

// --- Render Featured Products (FIXED: Wishlist Icon Logic) ---
function renderFeaturedProducts() {
    const grid = $('featured-products');
    if (!grid) return;
    grid.innerHTML = '';
    products.slice(0, 8).forEach((p, idx) => {
        const convertedPrice = (p.price * (rates[currency] || 1));
        let displayPrice = currency === 'INR' ? Math.round(convertedPrice) : convertedPrice.toFixed(2);
        
        // FIX: Ensure correct classes are used for the Font Awesome icon
        const isWishlisted = wishlist.some(item => item.name === p.name);
        const heartClass = isWishlisted ? 'fa-heart is-wishlisted' : 'fa-heart-o';

        const card = document.createElement('div');
        card.className = 'product-card';
        card.innerHTML = `
            <img src="${p.image}" alt="${p.name}">
            <h2>${p.name}</h2>
            <div class="price">${currency} ${displayPrice}</div>
            <div style="font-size:0.95em;color:#888;margin-bottom:0.5rem;">${p.category || ''}</div>
            <div class="product-actions">
                <button class="add-cart-btn" data-idx="${idx}"><i class="fa fa-cart-plus"></i></button>
                <button class="wishlist-btn" data-idx="${idx}"><i class="fa ${heartClass}"></i></button>
                <button class="details-btn" data-idx="${idx}"><i class="fa fa-eye"></i></button>
            </div>
        `;
        grid.appendChild(card);
    });

    // Add event listeners for actions
    grid.querySelectorAll('.add-cart-btn').forEach(btn => {
        btn.onclick = () => {
            const idx = parseInt(btn.getAttribute('data-idx'));
            addToCart(products[idx]);
        };
    });
    grid.querySelectorAll('.wishlist-btn').forEach(btn => {
        btn.onclick = () => {
            const idx = parseInt(btn.getAttribute('data-idx'));
            addToWishlist(products[idx]);
            renderFeaturedProducts();
        };
    });
    grid.querySelectorAll('.details-btn').forEach(btn => {
        btn.onclick = () => {
            const idx = parseInt(btn.getAttribute('data-idx'));
            showProductDetails(products[idx]);
        };
    });
}

// --- Show product details modal ---
function showProductDetails(product) {
    const modal = $('product-details-modal');
    const content = $('product-details-content');
    if (!modal || !content) return;

    const convertedPrice = (product.price * (rates[currency] || 1));
    let displayPrice = currency === 'INR' ? Math.round(convertedPrice) : convertedPrice.toFixed(2);
    
    const galleryImages = [product.image, ...(product.gallery || [])].filter((url, index, self) => url && self.indexOf(url) === index);
    
    content.innerHTML = `
        <div class="product-gallery-container">
            <img id="main-product-image" src="${galleryImages[0] || 'placeholder.jpg'}" alt="${product.name} Main View">
            
            <div id="thumbnail-gallery" class="thumbnail-gallery">
                ${galleryImages.map((imgUrl, index) => `
                    <img src="${imgUrl}" 
                         alt="${product.name} Thumbnail ${index + 1}" 
                         data-src="${imgUrl}"
                         class="${index === 0 ? 'active' : ''}">
                `).join('')}
            </div>
        </div>

        <h2>${product.name}</h2>
        <div class="price">${currency} ${displayPrice}</div>
        <div style="font-size:0.95em;color:#888;margin-bottom:0.5rem;">${product.category || ''}</div>
        <p>${product.description || 'No details available.'}</p>
        <div class="product-actions" style="justify-content:center;">
             <button class="add-cart-btn" data-name="${product.name}"><i class="fa fa-cart-plus"></i> Add to Cart</button>
        </div>
    `;

    // --- Image Switching Logic ---
    const mainImage = $('main-product-image');
    content.querySelectorAll('.thumbnail-gallery img').forEach(thumb => {
        thumb.onclick = () => {
            content.querySelectorAll('.thumbnail-gallery img').forEach(t => t.classList.remove('active'));
            thumb.classList.add('active');
            
            mainImage.style.opacity = 0;
            setTimeout(() => {
                mainImage.src = thumb.getAttribute('data-src');
                mainImage.style.opacity = 1;
            }, 100);
        };
    });

    content.querySelector('.add-cart-btn').onclick = () => addToCart(product);
    showModal('product-details-modal');
}

// --- Cart ---
function renderCart() {
    const cartList = $('cart-list');
    const cartSummary = $('cart-summary');
    if (!cartList || !cartSummary) return;

    cartList.innerHTML = '';
    if (!cart.length) {
        cartList.innerHTML = '<li style="color:#888;">Your cart is empty.</li>';
        cartSummary.textContent = '';
        return;
    }
    let totalInBaseCurrency = 0;
    
    cart.forEach((item, idx) => {
        // Use item.price (base currency) for total calculation
        totalInBaseCurrency += (item.price * (item.qty || 1));
        
        // Convert the item total for display
        const itemTotal = (item.price * (rates[currency] || 1) * (item.qty || 1));
        const displayTotal = currency === 'INR' ? Math.round(itemTotal) : itemTotal.toFixed(2);

        const li = document.createElement('li');
        li.innerHTML = `
            <img src="${item.image}" alt="${item.name}" style="width:40px;height:40px;border-radius:6px;">
            <span style="flex:1;">${item.name}</span>
            <span>Qty: <button class="cart-qty-minus" data-idx="${idx}">-</button> ${item.qty || 1} <button class="cart-qty-plus" data-idx="${idx}">+</button></span>
            <span>${currency} ${displayTotal}</span>
            <button class="cart-remove-btn" data-idx="${idx}" style="background:#e53935;color:#fff;border:none;border-radius:6px;padding:0.3rem 0.7rem;cursor:pointer;">&times;</button>
        `;
        cartList.appendChild(li);
    });
    
    const finalTotal = totalInBaseCurrency * (rates[currency] || 1);
    const displayFinalTotal = currency === 'INR' ? Math.round(finalTotal) : finalTotal.toFixed(2);
    cartSummary.textContent = `Total: ${currency} ${displayFinalTotal}`;

    // Quantity listeners
    cartList.querySelectorAll('.cart-qty-minus').forEach(btn => {
        btn.onclick = () => {
            const idx = parseInt(btn.getAttribute('data-idx'));
            if (cart[idx].qty > 1) {
                cart[idx].qty--;
            } else {
                cart.splice(idx, 1);
            }
            renderCart();
            updateCartCount();
        };
    });
    cartList.querySelectorAll('.cart-qty-plus').forEach(btn => {
        btn.onclick = () => {
            const idx = parseInt(btn.getAttribute('data-idx'));
            cart[idx].qty = (cart[idx].qty || 1) + 1;
            renderCart();
            updateCartCount();
        };
    });
    cartList.querySelectorAll('.cart-remove-btn').forEach(btn => {
        btn.onclick = () => {
            const idx = parseInt(btn.getAttribute('data-idx'));
            cart.splice(idx, 1);
            renderCart();
            updateCartCount();
        };
    });
}
function setupCart() {
    $('nav-cart').onclick = () => {
        showModal('cart-modal');
    };
    const checkoutBtn = $('checkout-btn');
    if (checkoutBtn) checkoutBtn.onclick = () => {
        if (!cart.length) {
            showNotification('Cart is empty');
            return;
        }
        const total = cart.reduce((sum, item) => sum + (item.price * (item.qty || 1)), 0);
        const order = { id: Date.now(), date: new Date().toLocaleDateString(), status: 'Placed', items: cart, total: total };
        orders.unshift(order);
        cart.length = 0; // Clear cart
        showNotification('Order Placed Successfully!');
        renderCart();
        updateCartCount();
    };
}
// --- Wishlist (FIXED: Full implementation) ---
function renderWishlist() {
    const wishlistList = $('wishlist-list');
    if (!wishlistList) return;
    wishlistList.innerHTML = '';
    
    if (!wishlist.length) {
        wishlistList.innerHTML = '<li style="color:#888;">Your wishlist is empty.</li>';
        return;
    }
    
    wishlist.forEach((item, idx) => {
        const convertedPrice = (item.price * (rates[currency] || 1));
        const displayPrice = currency === 'INR' ? Math.round(convertedPrice) : convertedPrice.toFixed(2);

        const li = document.createElement('li');
        li.innerHTML = `
            <img src="${item.image}" alt="${item.name}" style="width:40px;height:40px;border-radius:6px;">
            <span style="flex:1;">${item.name}</span>
            <span>${currency} ${displayPrice}</span>
            <button class="wishlist-add-to-cart-btn" data-idx="${idx}" style="background:#4CAF50;color:#fff;border:none;border-radius:6px;padding:0.3rem 0.7rem;cursor:pointer;">Add to Cart</button>
            <button class="wishlist-remove-btn" data-idx="${idx}" style="background:#e53935;color:#fff;border:none;border-radius:6px;padding:0.3rem 0.7rem;cursor:pointer;">&times;</button>
        `;
        wishlistList.appendChild(li);
    });

    // Event listeners for buttons within the modal
    wishlistList.querySelectorAll('.wishlist-remove-btn').forEach(btn => {
        btn.onclick = () => {
            const idx = parseInt(btn.getAttribute('data-idx'));
            wishlist.splice(idx, 1);
            saveWishlist();
            renderWishlist();
            renderProducts(); // Update product grid heart icons
            renderFeaturedProducts();
        };
    });

    wishlistList.querySelectorAll('.wishlist-add-to-cart-btn').forEach(btn => {
        btn.onclick = () => {
            const idx = parseInt(btn.getAttribute('data-idx'));
            const productToAdd = wishlist[idx];
            
            // 1. Add to cart
            addToCart(productToAdd);

            // 2. Optional: Remove from wishlist after moving to cart
            wishlist.splice(idx, 1);
            saveWishlist();

            // 3. Update UI
            renderWishlist();
            renderProducts();
        };
    });
}
function setupWishlist() {
    // Only link the navigation button to open the modal
    $('nav-wishlist').onclick = () => showModal('wishlist-modal');
}
// --- Orders (Placeholder render function added for reRenderAllPrices) ---
function renderOrders() {
    const ordersList = $('orders-list');
    if (!ordersList) return;
    ordersList.innerHTML = '';
    if (!orders.length) {
        ordersList.innerHTML = '<li style="color:#888;">No orders yet.</li>';
        return;
    }
    orders.forEach(order => {
        const orderTotalConverted = (order.total * (rates[currency] || 1));
        const displayTotal = currency === 'INR' ? Math.round(orderTotalConverted) : orderTotalConverted.toFixed(2);
        const li = document.createElement('li');
        li.innerHTML = `
            <div> 
                <b>Order #${order.id}</b> - <span style="color:${order.status === 'Placed' ? '#1a8917' : '#888'}">${order.status}</span>
                <br> <small>${order.date}</small>
            </div>
            <div> ${order.items.map(i => `${i.name} x${i.qty}`).join(', ')} </div>
            <div> Total: ${currency} ${displayTotal} </div>
        `;
        ordersList.appendChild(li);
    });
}
function setupOrders() {
    $('nav-orders').onclick = () => showModal('orders-modal');
}

// --- Currency (FIXED: Uses reRenderAllPrices) ---
function setupCurrency() {
    const currencySelect = $('currency-select');
    if (currencySelect) {
        currencySelect.value = currency;
        currencySelect.onchange = () => {
            currency = currencySelect.value;
            localStorage.setItem('currency', currency); // Persist currency
            reRenderAllPrices();
        };
    }
}

// ----------------------------------------------------------------------
// --- Remaining setup functions (Simplified) ---
// ----------------------------------------------------------------------

function setupAddressBook() { /* ... setup ... */ }
function setupCoupons() { /* ... setup ... */ }
function setupQA() { /* ... setup ... */ }
function setupAccount() { /* ... setup ... */ }
function setupNotifications() { /* ... setup ... */ }
function setupSupport() { 
    $('nav-support').onclick = () => showModal('support-modal-new');
}
function renderRecentlyViewed() { 
    const grid = $('recently-viewed-grid');
    if (!grid) return;
    grid.innerHTML = '';
    products.slice(0, 4).forEach((p, idx) => {
        const convertedPrice = (p.price * (rates[currency] || 1));
        let displayPrice = currency === 'INR' ? Math.round(convertedPrice) : convertedPrice.toFixed(2);
        const card = document.createElement('div');
        card.className = 'product-card';
        card.innerHTML = `
            <img src="${p.image}" alt="${p.name}">
            <h2>${p.name}</h2>
            <div class="price">${currency} ${displayPrice}</div>
            <div class="product-actions" style="justify-content:center;">
                <button class="add-cart-btn" data-idx="${idx}">Buy</button>
            </div>
        `;
        grid.appendChild(card);
    });
}
function setupNewsletter() { 
    $('newsletter-form')?.addEventListener('submit', function(e) {
        e.preventDefault();
        const email = $('newsletter-email').value;
        const msg = $('newsletter-msg');
        if (email) {
            msg.textContent = `Thank you for subscribing, ${email}!`;
            $('newsletter-email').value = '';
        } else {
            msg.textContent = 'Please enter a valid email.';
        }
    });
}
function showNotification(msg) { 
    const container = $('notification-container');
    if (!container) return;

    const notification = document.createElement('div');
    notification.className = 'notification';
    notification.innerHTML = `<i class="fa fa-check-circle"></i> ${msg}`;

    container.appendChild(notification);

    // Animate in
    setTimeout(() => {
        notification.style.opacity = 1;
        notification.style.transform = 'translateX(0)';
    }, 50);

    // Animate out and remove
    setTimeout(() => {
        notification.style.opacity = 0;
        notification.style.transform = 'translateX(100%)';
        setTimeout(() => {
            notification.remove();
        }, 300);
    }, 3000);
}

// REMOVED: The extra closing brace '}' that was wrapping the last few functions and causing issues.