// ===========================================================================
//  FIREBASE CONFIGURATION & INITIALIZATION
// ===========================================================================

/**
 * Firebase configuration object containing API keys and project details
 * @constant {Object} firebaseConfig
 */
const firebaseConfig = {
    apiKey: "ENCRYPTED",
    authDomain: "joiful-app-960a0.firebaseapp.com",
    projectId: "joiful-app-960a0",
    storageBucket: "joiful-app-960a0.appspot.com",
    messagingSenderId: "253451897123",
    appId: "1:253451897123:web:a2e0ef3b26857521412496"
};

// Initialize Firebase services
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();  // Firestore database instance
const auth = firebase.auth();     // Authentication service instance

// ===========================================================================
//  DOM ELEMENT REFERENCES
// ===========================================================================

/**
 * Cached references to key DOM elements for efficient access
 * @constant {HTMLElement} authSection - Authentication section container
 * @constant {HTMLElement} homeSection - Main app section container
 * @constant {HTMLElement} logoutButton - Logout button element
 * @constant {HTMLElement} goPremiumButton - Premium upgrade button
 * @constant {HTMLElement} userGreeting - User welcome message element
 */
const authSection = document.getElementById('auth');
const homeSection = document.getElementById('home');
const logoutButton = document.getElementById('logoutButton');
const goPremiumButton = document.getElementById('goPremiumButton');
const userGreeting = document.getElementById('userGreeting');

// ===========================================================================
//  APPLICATION STATE MANAGEMENT
// ===========================================================================

/**
 * Global state variables
 * @var {Object|null} currentUser - Currently authenticated user
 * @var {string|null} selectedPlan - Selected premium plan type
 * @var {string|null} currentLogDate - Currently selected log date
 * @var {boolean} chatbotScriptsLoaded - Flag for chatbot initialization status
 * @var {MutationObserver|null} styleObserver - Observer for chatbot UI elements
 */
let currentUser = null;
let selectedPlan = null;
let currentLogDate = null;
let chatbotScriptsLoaded = false;
let styleObserver = null;

// ===========================================================================
//  AUTHENTICATION FUNCTIONS
// ===========================================================================

/**
 * Toggles between login and signup forms
 * @function showSignUp
 */
function showSignUp() {
    document.getElementById('loginContainer').style.display = 'none';
    document.getElementById('signupContainer').style.display = 'block';
}

/**
 * Displays login form and hides signup form
 * @function showLogin
 */
function showLogin() {
    document.getElementById('signupContainer').style.display = 'none';
    document.getElementById('loginContainer').style.display = 'block';
}

/**
 * Handles user sign-in with email/password
 * @async
 * @function signIn
 */
async function signIn() {
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    if (!email || !password) {
        alert('Please fill in both email and password.');
        return;
    }

    try {
        await auth.signInWithEmailAndPassword(email, password);
    } catch (error) {
        alert("Sign in failed: " + error.message);
    }
}


/**
 * Handles new user registration
 * @async
 * @function signUp
 */
async function sendPasswordReset() {
    const email = document.getElementById('email').value;
    
    // If email field is empty, prompt user
    if (!email) {
      email = prompt('Please enter your email address:');
      if (!email) return;
    }
  
    try {
      await auth.sendPasswordResetEmail(email);
      alert('Password reset email sent! Check your inbox (and spam folder)');
    } catch (error) {
      console.error('Password reset error:', error);
      let message = 'Error sending reset email: ';
      
      // User-friendly error messages
      switch (error.code) {
        case 'auth/user-not-found':
          message += 'No account found with this email';
          break;
        case 'auth/invalid-email':
          message += 'Invalid email address';
          break;
        default:
          message += error.message;
      }
      
      alert(message);
    }
  }

/**
 * Handles new user registration
 * @async
 * @function signUp
 */
async function signUp() {
    const email = document.getElementById('signupEmail').value;
    const password = document.getElementById('signupPassword').value;
    const username = document.getElementById('username').value;

    if (!email || !password || !username) {
        alert('Please fill in all fields.');
        return;
    }

    try {
        const userCredential = await auth.createUserWithEmailAndPassword(email, password);
        await db.collection('users').doc(userCredential.user.uid).set({
            email,
            username,
            isPremium: false,
            currentStreak: 0,
            lastLogDate: null,
            longestStreak: 0,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        alert('Account created!');
        showLogin();
    } catch (error) {
        alert("Sign up failed: " + error.message);
    }
}

// ===========================================================================
//  AUTHENTICATION STATE LISTENER
// ===========================================================================

/**
 * Handles authentication state changes
 * @listens auth/onAuthStateChanged
 */
auth.onAuthStateChanged(async (user) => {
    // Clean up previous session
    destroyChatbot();

    if (user) {
        // User is signed in
        currentUser = user;
        const userDoc = await db.collection('users').doc(user.uid).get();

        // Handle premium status
        if (userDoc.exists && userDoc.data().isPremium) {
            initChatbot();
            goPremiumButton.style.display = 'none';
        } else {
            goPremiumButton.style.display = 'block';
        }

        // Update UI
        authSection.style.display = 'none';
        homeSection.style.display = 'block';
        logoutButton.style.display = 'block';
        loadLogsList();
    } else {
        // User is signed out
        currentUser = null;
        authSection.style.display = 'flex';
        homeSection.style.display = 'none';
        logoutButton.style.display = 'none';
        goPremiumButton.style.display = 'none';
    }
});

// ===========================================================================
//  MOCK PAYMENT PROCESSING SYSTEM
// ===========================================================================

/**
 * Mock payment processor class simulating API calls
 * @class MockPaymentAPI
 */
class MockPaymentAPI {
    constructor() {
        this.successRate = 0.8; // 80% success rate
    }

    /**
     * Simulates payment processing with artificial delay
     * @async
     * @method processPayment
     * @param {Object} cardDetails - Payment card information
     * @returns {Promise<Object>} Payment result
     */
    async processPayment(cardDetails) {
        // Simulate network latency
        await new Promise(resolve => setTimeout(resolve, 1500));

        if (!this.validateCard(cardDetails)) {
            return { success: false, message: 'Invalid card details' };
        }

        // Simulate random success/failure
        return Math.random() < this.successRate 
            ? { success: true, transactionId: `MOCK_${Date.now()}` }
            : { success: false, message: 'Payment declined by issuer' };
    }

    /**
     * Validates card details format
     * @method validateCard
     * @param {Object} cardDetails - Payment card information
     * @returns {boolean} Validation result
     */
    validateCard({ number, expiry, cvc }) {
        const cleanNumber = number.replace(/\s/g, '');
        return /^\d{13,19}$/.test(cleanNumber) && // Validate card number
            /^(0[1-9]|1[0-2])\/?([2-9]\d)$/.test(expiry) && // Validate expiry
            /^\d{3,4}$/.test(cvc); // Validate CVC
    }
}

const paymentAPI = new MockPaymentAPI();

// ===========================================================================
//  PAYMENT HANDLING FUNCTIONS
// ===========================================================================

/**
 * Handles premium plan selection
 * @function selectPlan
 * @param {string} planType - 'monthly' or 'yearly'
 */
function selectPlan(planType) {
    selectedPlan = planType;
    document.querySelectorAll('.plan').forEach(plan => plan.classList.remove('selected'));
    document.getElementById(`${planType}Plan`).classList.add('selected');
    document.getElementById('paymentForm').style.display = 'block';
}

// Input formatting handlers
document.getElementById('cardNumber').addEventListener('input', function(e) {
    // Format card number with spaces
    let value = e.target.value.replace(/\s/g, '');
    if (value.length > 16) value = value.substring(0, 16);
    e.target.value = value.match(/.{1,4}/g)?.join(' ') || '';
});

document.getElementById('cardExpiry').addEventListener('input', function(e) {
    // Format expiry date as MM/YY
    let value = e.target.value.replace(/\D/g, '');
    if (value.length > 2) {
        value = value.substring(0, 2) + '/' + value.substring(2, 4);
    }
    e.target.value = value;
});

document.getElementById('cardCvc').addEventListener('input', function(e) {
    // Limit CVC to 4 digits
    e.target.value = e.target.value.replace(/\D/g, '').substring(0, 4);
});

/**
 * Processes mock payment and upgrades user to premium
 * @async
 * @function processPayment
 */
async function processPayment() {
    if (!selectedPlan) {
        alert('Please select a plan first.');
        return;
    }

    const paymentButton = document.querySelector('#paymentForm button');
    try {
        // Get and validate payment details
        const cardDetails = {
            number: document.getElementById('cardNumber').value,
            expiry: document.getElementById('cardExpiry').value,
            cvc: document.getElementById('cardCvc').value
        };

        // Show loading state
        paymentButton.innerHTML = 'Processing...';
        paymentButton.disabled = true;

        // Process mock payment
        const result = await paymentAPI.processPayment(cardDetails);

        if (!result.success) {
            throw new Error(result.message);
        }

        // Update user premium status
        await db.collection('users').doc(currentUser.uid).update({
            isPremium: true,
            premiumSince: firebase.firestore.FieldValue.serverTimestamp(),
            planType: selectedPlan
        });

        // Update UI
        alert('Payment successful! Welcome to Premium!');
        closePaymentModal();
        goPremiumButton.style.display = 'none';
        initChatbot();
    } catch (error) {
        console.error('Payment error:', error);
        alert(`Payment failed: ${error.message}`);
    } finally {
        // Reset button state
        paymentButton.innerHTML = 'Complete';
        paymentButton.disabled = false;
    }
}

/**
 * Closes payment modal and resets selection
 * @function closePaymentModal
 */
function closePaymentModal() {
    document.getElementById('paymentModal').style.display = 'none';
    selectedPlan = null;
    document.getElementById('paymentForm').style.display = 'none';
    document.querySelectorAll('.plan').forEach(plan => plan.classList.remove('selected'));
}

// ===========================================================================
//  LOG MANAGEMENT SYSTEM
// ===========================================================================

/**
 * Loads and displays user's log entries
 * @async
 * @function loadLogsList
 */
async function loadLogsList() {
    const logsContainer = document.getElementById('logsList');
    try {
        // Clear only previous logs, keep header if exists
        const existingHeader = logsContainer.querySelector('.user-header-section');
        if (!existingHeader) {
            logsContainer.innerHTML = '<p class="loading-text">Loading entries...</p>';
        }

        const userDoc = await db.collection('users').doc(currentUser.uid).get();
        const userData = userDoc.data();
        const snapshot = await db.collection('users').doc(currentUser.uid)
            .collection('logs').orderBy('date', 'desc').limit(30).get();

        // Clear loading/previous content but preserve header
        logsContainer.innerHTML = '';
        
        // Create header section and streak
        const headerSection = document.createElement('div');
        headerSection.className = 'user-header-section';
        headerSection.innerHTML = `
            <h2 class="username-header">${userData.username}'s Joi Logs</h2>
            <div class="streak-container">
                <div class="current-streak">🔥 ${userData.currentStreak || 0}-Day Streak</div>
                <div class="longest-streak">🏆 Record: ${userData.longestStreak || 0} Days</div>
            </div>
        `;
        logsContainer.appendChild(headerSection);

        if (snapshot.empty) {
            const emptyState = document.createElement('p');
            emptyState.className = 'empty-state';
            emptyState.textContent = 'No logs found. Start by creating a new log!';
            logsContainer.appendChild(emptyState);
            return;
        }

        // Render log entries
        snapshot.forEach(doc => {
            const log = doc.data();
            const logEntry = document.createElement('div');
            logEntry.className = 'log-entry';
            logEntry.innerHTML = `
                <div class="log-date">${formatDisplayDate(log.date)}</div>
                <div class="log-actions">
                    <button class="open-log-btn" onclick="loadExistingLog('${log.date}')">Open</button>
                    <button class="delete-btn" onclick="deleteLog('${log.date}')">Delete</button>
                </div>
            `;
            logsContainer.appendChild(logEntry);
        });

    } catch (error) {
        const errorState = document.createElement('p');
        errorState.className = 'error-state';
        errorState.textContent = 'Error loading entries';
        logsContainer.appendChild(errorState);
    }
}

/**
 * Deletes a log entry
 * @async
 * @function deleteLog
 * @param {string} date - Log date in YYYY-MM-DD format
 */
async function deleteLog(date) {
    if (!confirm('Are you sure you want to delete this entry?')) return;

    try {
        await db.collection('users').doc(currentUser.uid)
            .collection('logs').doc(date).delete();
        loadLogsList();
    } catch (error) {
        alert('Error deleting log: ' + error.message);
    }
}

/**
 * Loads existing log for editing
 * @async
 * @function loadExistingLog
 * @param {string} date - Log date in YYYY-MM-DD format
 */
async function loadExistingLog(date) {
    try {
        currentLogDate = date;
        document.getElementById('datePicker').value = date;
        await openLogForDate();
        document.getElementById('logModal').style.display = 'block';
    } catch (error) {
        alert('Error opening log: ' + error.message);
    }
}

/**
 * Loads log data for selected date
 * @async
 * @function openLogForDate
 */
async function openLogForDate() {
    if (!currentLogDate) return;

    try {
        // Clear existing fields
        document.getElementById('taskList').innerHTML = '';
        document.getElementById('reflection1').value = '';
        document.getElementById('reflection2').value = '';
        document.getElementById('reflection3').value = '';

        // Set formatted date
        document.getElementById('formattedDate').textContent = formatDisplayDate(currentLogDate);

        // Load log data
        const logDoc = await db.collection('users').doc(currentUser.uid)
            .collection('logs').doc(currentLogDate).get();

        if (logDoc.exists) {
            const data = logDoc.data();
            data.tasks.forEach(task => addTaskField(task));
            document.getElementById('reflection1').value = data.reflection1 || '';
            document.getElementById('reflection2').value = data.reflection2 || '';
            document.getElementById('reflection3').value = data.reflection3 || '';
        } else {
            addTaskField();
        }
    } catch (error) {
        alert('Error loading log: ' + error.message);
    }
}

/**
 * Prepares new log entry with current date
 * @function prepareNewLog
 */
function prepareNewLog() {
    const datePicker = document.getElementById('datePicker');
    const date = datePicker.value;

    // Set default to today if empty
    if (!date) {
        const today = new Date().toISOString().split('T')[0];
        datePicker.value = today;
        currentLogDate = today;
    } else {
        currentLogDate = date;
    }

    // Clear previous content
    document.getElementById('taskList').innerHTML = '';
    document.getElementById('reflection1').value = '';
    document.getElementById('reflection2').value = '';
    document.getElementById('reflection3').value = '';

    addTaskField();
    document.getElementById('logModal').style.display = 'block';
    document.getElementById('formattedDate').textContent = formatDisplayDate(currentLogDate);
}

/**
 * Saves log entry to Firestore
 * @async
 * @function saveLog
 */
async function saveLog() {
    const date = document.getElementById('datePicker').value;
    if (!date) {
        alert('Please select a date before saving.');
        return;
    }

    // Collect task data
    const tasks = Array.from(document.querySelectorAll('.task-input')).map(taskDiv => ({
        title: taskDiv.querySelector('input:nth-child(1)').value,
        rating: taskDiv.querySelector('select').value,
        notes: taskDiv.querySelector('input:nth-child(3)').value
    })).filter(task => task.title.trim() !== '');

    // Prepare log document
    const logData = {
        tasks,
        reflection1: document.getElementById('reflection1').value,
        reflection2: document.getElementById('reflection2').value,
        reflection3: document.getElementById('reflection3').value,
        date: date,
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
    };

    try {
        // Save log to Firestore
        await db.collection('users').doc(currentUser.uid)
            .collection('logs').doc(date).set(logData);

        // Update streak information
        const userRef = db.collection('users').doc(currentUser.uid);
        const userDoc = await userRef.get();
        
        const currentStreak = calculateStreak(
            userDoc.data().currentStreak,
            userDoc.data().lastLogDate
        );

        await userRef.update({
            currentStreak,
            lastLogDate: firebase.firestore.FieldValue.serverTimestamp(),
            longestStreak: Math.max(currentStreak, userDoc.data().longestStreak)
        });

        closeModal();
        loadLogsList();
    } catch (error) {
        alert('Error saving log: ' + error.message);
    }
}

// ===========================================================================
//  HELPER FUNCTIONS
// ===========================================================================

/**
 * Formats date string for display
 * @function formatDisplayDate
 * @param {string} dateString - ISO date string
 * @returns {string} Formatted date string (MM/DD/YYYY (Day))
 */
function formatDisplayDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
        month: '2-digit',
        day: '2-digit',
        year: 'numeric',
        timeZone: 'UTC'
    }) + ' (' + date.toLocaleDateString('en-US', {
        weekday: 'short',
        timeZone: 'UTC'
    }) + ')';
}

/**
 * Calculates current streak based on last log date
 * @function calculateStreak
 * @param {number} currentStreak - Current streak count
 * @param {Timestamp|null} lastLogDate - Firestore timestamp of last log
 * @returns {number} Updated streak count
 */
function calculateStreak(currentStreak, lastLogDate) {
    if (!lastLogDate) return 1;
    
    const lastLog = lastLogDate.toDate();
    const today = new Date();
    
    // Normalize times to midnight for accurate day comparison
    lastLog.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);
    
    const timeDiff = today - lastLog;
    const dayDiff = Math.floor(timeDiff / (1000 * 60 * 60 * 24));

    if (dayDiff === 0) return currentStreak;    // Same day
    if (dayDiff === 1) return currentStreak + 1; // Consecutive day
    return 1; // Broken streak
}

/**
 * Adds task input fields to log modal
 * @function addTaskField
 * @param {Object} [taskData] - Existing task data to prefill
 */
function addTaskField(taskData = {}) {
    // Create headers if they don't exist
    if (!document.querySelector('.task-headers')) {
        const headers = document.createElement('div');
        headers.className = 'task-headers';
        headers.innerHTML = `
            <div>Task</div>
            <div>Joi Rating (1-10)</div>
            <div>Notes</div>
            <div></div>
        `;
        document.getElementById('taskList').appendChild(headers);
    }
    
    // Create new task input row
    const taskDiv = document.createElement('div');
    taskDiv.className = 'task-input';
    taskDiv.innerHTML = `
        <input type="text" placeholder="Task description" value="${taskData.title || ''}">
        <select>
            ${Array.from({ length: 10 }, (_, i) =>
                `<option value="${i + 1}" ${(i + 1 == taskData.rating) ? 'selected' : ''}>${i + 1}</option>`
            ).join('')}
        </select>
        <input type="text" placeholder="Enjoyment notes" value="${taskData.notes || ''}">
        <button class="delete-task-btn" onclick="this.parentElement.remove()">Delete</button>
    `;
    document.getElementById('taskList').appendChild(taskDiv);
}

/**
 * Closes log modal and resets state
 * @function closeModal
 */
function closeModal() {
    document.getElementById('logModal').style.display = 'none';
    document.getElementById('taskList').innerHTML = '';
    document.getElementById('reflection1').value = '';
    document.getElementById('reflection2').value = '';
    document.getElementById('reflection3').value = '';
    currentLogDate = null;
}

// ===========================================================================
//  CHATBOT INTEGRATION (PREMIUM FEATURE)
// ===========================================================================

/**
 * Initializes Botpress chatbot
 * @async
 * @function initChatbot
 * @returns {Promise} Resolves when chatbot is loaded
 */
function initChatbot() {
    return new Promise((resolve) => {
        if (chatbotScriptsLoaded) return resolve();

        // Load Botpress scripts
        const script1 = document.createElement('script');
        script1.src = 'https://cdn.botpress.cloud/webchat/v2.2/inject.js';

        script1.onload = () => {
            const script2 = document.createElement('script');
            script2.src = 'https://files.bpcontent.cloud/2025/02/23/23/20250223232916-Z7Y1HV9U.js';

            script2.onload = () => {
                chatbotScriptsLoaded = true;
                initializeBotpressInstance();
                resolve();
            };

            document.body.appendChild(script2);
        };

        document.body.appendChild(script1);
    });
}

/**
 * Configures Botpress instance with custom styling
 * @function initializeBotpressInstance
 */
function initializeBotpressInstance() {
    window.botpress.init({
        "botId": "5b611ca3-5110-409a-8014-f7d074efb0d9",
        "configuration": {
            "color": "#FFD93D",
            "fontFamily": "Baloo Thambi 2",
            "radius": 15,
            "disableAnimations": true
        },
        "clientId": "8a938154-9080-4361-8792-d52fb8b915e3"
    });

    // Mutation observer for custom styling
    styleObserver = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.addedNodes) {
                mutation.addedNodes.forEach((node) => {
                    if (node.classList?.contains('bpw-floating-button')) {
                        node.innerHTML = 'Joi Coach';
                        node.style.cssText = `
                            background: #FFD93D !important;
                            color: #947E26 !important;
                            font-family: 'Baloo Thambi 2' !important;
                            font-size: 16px !important;
                            padding: 15px 25px !important;
                            border-radius: 25px !important;
                            right: 20px !important;
                            bottom: 20px !important;
                            box-shadow: 0 4px 8px rgba(0,0,0,0.1) !important;
                        `;
                    }
                });
            }
        });
    });

    styleObserver.observe(document.body, {
        childList: true,
        subtree: true
    });
}

/**
 * Removes chatbot elements and cleans up
 * @function destroyChatbot
 */
function destroyChatbot() {
    // Remove DOM elements
    document.querySelectorAll('.bpw-floating-button, #webchat-container').forEach(el => el.remove());
    
    // Clean up Botpress instances
    if (window.botpressWebChat) {
        window.botpressWebChat.sendEvent({ type: 'hide' });
        window.botpressWebChat = null;
    }
    
    // Remove scripts
    document.querySelectorAll('script[src*="botpress"]').forEach(script => script.remove());
    
    // Disconnect observer
    if (styleObserver) styleObserver.disconnect();
    chatbotScriptsLoaded = false;
}

// ===========================================================================
//  EVENT LISTENERS
// ===========================================================================

// Handle logout
logoutButton.addEventListener('click', () => {
    // Clear chatbot-related storage
    const storageKeys = Object.keys(localStorage).filter(key => key.startsWith('botpress'));
    storageKeys.forEach(key => localStorage.removeItem(key));
    
    // Sign out and reload
    auth.signOut().then(() => {
        window.location.reload(true);
    });
});

// Handle date picker changes
document.getElementById('datePicker').addEventListener('change', (e) => {
    currentLogDate = e.target.value;
    document.getElementById('formattedDate').textContent = formatDisplayDate(e.target.value);
});

// Show premium modal
document.getElementById('goPremiumButton').addEventListener('click', () => {
    document.getElementById('paymentModal').style.display = 'block';
});
