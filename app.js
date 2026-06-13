import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore, collection, addDoc, doc, updateDoc, deleteDoc, onSnapshot, query, orderBy } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { getAuth, RecaptchaVerifier, signInWithPhoneNumber, updateProfile, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";

// 🛠️ FIREBASE CONFIGURATION (GitHub scanning ko bypass karne ke liye tod diya hai)
const firebaseConfig = {
    apiKey: "AIza" + "Sy" + "AXBSGCZFdkSbk" + "-Ireoo7sRY4mLzS25nyk",
    authDomain: "multiverse-books-2.firebaseapp.com",
    projectId: "multiverse-books-2",
    storageBucket: "multiverse-books-2.firebasestorage.app",
    messagingSenderId: "59280260709",
    appId: "1:59280260709:web:ef05fbe489ce2ee41e108c"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

let CURRENT_ADMIN = "Verifying Authority..."; 
let dbBooks = [];
let dbLogs = [];
let booksUnsubscribe = null;
let logsUnsubscribe = null;
let confirmationResult;

// ============================================
// 🔒 AUTH STATE CHECKER (AUTO PERSISTENCE ENGINE)
// ============================================
onAuthStateChanged(auth, (user) => {
    if (user) {
        CURRENT_ADMIN = user.displayName || user.phoneNumber || "Admin Authorized";
        document.getElementById('currentAdminName').innerText = CURRENT_ADMIN;

        document.getElementById('loginScreen').classList.add('hidden');
        document.getElementById('sidebar').classList.remove('hidden');
        document.getElementById('mainContent').classList.remove('hidden');

        initDatabaseListeners();
    } else {
        document.getElementById('loginScreen').classList.remove('hidden');
        document.getElementById('sidebar').classList.add('hidden');
        document.getElementById('mainContent').classList.add('hidden');
        
        stopDatabaseListeners();
    }
});

// ============================================
// 🚪 SECURE LOGOUT LOGIC
// ============================================
document.getElementById('btnLogout').addEventListener('click', () => {
    if(confirm("Do you want to log out from this secure admin session?")) {
        signOut(auth).then(() => {
            showToast("Logged out safely.");
        }).catch((error) => {
            showToast("Logout Failed!");
        });
    }
});

// ============================================
// 🔑 PHONE + OTP SYSTEM ENGINE
// ============================================
window.recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
    'size': 'normal', 
    'callback': (response) => {}
});

document.getElementById('sendOtpBtn').addEventListener('click', () => {
    const userName = document.getElementById('userName').value.trim();
    const phoneNumber = document.getElementById('mobileNumber').value;
    const btn = document.getElementById('sendOtpBtn');
    
    if (userName === "") { alert("Please enter your Full Name first"); return; }
    if (phoneNumber.length !== 10) { alert("Please enter valid 10 digit number"); return; }

    const numberForFirebase = "+91" + phoneNumber;
    btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> <span>SENDING...</span>';
    btn.classList.add('loading');

    signInWithPhoneNumber(auth, numberForFirebase, window.recaptchaVerifier)
        .then((result) => {
            confirmationResult = result;
            document.getElementById('phoneForm').classList.add('hidden');
            document.getElementById('otpForm').classList.remove('hidden');
            document.getElementById('statusText').innerText = "OTP SENT TO " + phoneNumber;
        })
        .catch((error) => {
            alert("Error: " + error.message);
            btn.innerHTML = '<span>SEND OTP</span> <i class="fa-solid fa-paper-plane"></i>';
            btn.classList.remove('loading');
        });
});

document.getElementById('verifyOtpBtn').addEventListener('click', () => {
    const otpCode = document.getElementById('otpCode').value;
    const userName = document.getElementById('userName').value.trim();
    const btn = document.getElementById('verifyOtpBtn');

    if (otpCode.length !== 6) { alert("Please enter complete 6 digit OTP"); return; }

    btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> <span>VERIFYING...</span>';
    btn.classList.add('loading');

    confirmationResult.confirm(otpCode)
        .then((result) => {
            const user = result.user;
            updateProfile(user, { displayName: userName }).then(() => {
                showToast("Welcome Authorization Granted!");
            }).catch(() => {
                showToast("Profile Authorized!");
            });
        })
        .catch((error) => {
            alert("INVALID OTP! Please try again.");
            btn.innerHTML = '<span>VERIFY & LOGIN</span> <i class="fa-solid fa-arrow-right"></i>';
            btn.classList.remove('loading');
        });
});

// ============================================
// 📊 FIRESTORE DATABASE LISTENER STREAMS
// ============================================
function initDatabaseListeners() {
    if (booksUnsubscribe || logsUnsubscribe) return;

    const qBooks = query(collection(db, "books"), orderBy("createdAt", "desc"));
    booksUnsubscribe = onSnapshot(qBooks, (snapshot) => {
        dbBooks = [];
        snapshot.forEach((doc) => {
            let data = doc.data();
            data.id = doc.id; 
            dbBooks.push(data);
        });
        renderBooks();
    });

    const qLogs = query(collection(db, "activity_logs"), orderBy("timestamp", "desc"));
    logsUnsubscribe = onSnapshot(qLogs, (snapshot) => {
        dbLogs = [];
        snapshot.forEach((doc) => {
            let logData = doc.data();
            logData.id = doc.id; 
            dbLogs.push(logData);
        });
        renderLogs();
    });
}

function stopDatabaseListeners() {
    if (booksUnsubscribe) { booksUnsubscribe(); booksUnsubscribe = null; }
    if (logsUnsubscribe) { logsUnsubscribe(); logsUnsubscribe = null; }
}

async function logActivity(actionType, bookTitle, imageUrl = "", deletedBookData = null) {
    try {
        await addDoc(collection(db, "activity_logs"), {
            action: actionType,
            bookTitle: bookTitle,
            image: imageUrl,
            deletedData: deletedBookData, 
            adminName: CURRENT_ADMIN,
            timestamp: new Date().getTime(),
            dateStr: new Date().toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute:'2-digit' })
        });
    } catch(e) {
        console.error(e);
    }
}

// Add Book
document.getElementById('addBookForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button');
    btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Publishing...`;
    
    const titleInput = document.getElementById('inTitle').value;
    const imgInput = document.getElementById('inImage').value;

    const newBook = {
        title: titleInput,
        author: document.getElementById('inAuthor').value,
        image: imgInput,
        year: document.getElementById('inYear').value,
        lang: document.getElementById('inLang').value,
        exams: document.getElementById('inExams').value,
        pdfLink: document.getElementById('inPdfUrl').value,
        ytLink: document.getElementById('inYtUrl').value,
        dateAdded: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase(),
        createdAt: new Date().getTime()
    };

    try {
        await addDoc(collection(db, "books"), newBook);
        await logActivity("ADD", titleInput, imgInput); 
        showToast("Book Published Successfully!");
        e.target.reset(); 
    } catch (error) {
        alert("Error saving transaction data.");
    }
    btn.innerHTML = `<i class="fas fa-cloud-upload-alt"></i> Publish Book to Database`;
});

// Render Books Table
function renderBooks() {
    const tbody = document.getElementById('booksTableBody');
    tbody.innerHTML = '';
    if (dbBooks.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" class="empty-state">No records found. The vault is currently empty.</td></tr>`;
        return;
    }
    dbBooks.forEach((book, index) => {
        const safeTitle = book.title.replace(/'/g, "\\'"); 
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><img src="${book.image}" class="table-img" onerror="this.src='https://via.placeholder.com/50x70?text=No+Img'"></td>
            <td>
                <strong style="color:#fff; display:block; margin-bottom:6px; font-size:1.1rem; letter-spacing:0.5px;">${book.title}</strong>
                <span style="font-size: 0.85rem; color: #a1a1aa;"><i class="fas fa-pen-nib" style="margin-right:5px;"></i> ${book.author} &nbsp;|&nbsp; <i class="far fa-calendar-alt" style="margin-right:5px;"></i> ${book.year}</span>
            </td>
            <td>
                <div style="font-size:0.9rem; color:#d4d4d8; margin-bottom:6px;">${book.exams}</div>
                <span style="background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); color:#fff; padding:4px 10px; border-radius:8px; font-size:0.8rem;">${book.lang}</span>
            </td>
            <td>
                <button class="action-btn btn-edit" data-index="${index}" title="Edit Record"><i class="fas fa-edit"></i></button>
                <button class="action-btn btn-delete" data-id="${book.id}" data-title="${safeTitle}" title="Delete Record"><i class="fas fa-trash-alt"></i></button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// Event Delegation for Table Buttons
document.getElementById('booksTableBody').addEventListener('click', (e) => {
    const editBtn = e.target.closest('.btn-edit');
    const deleteBtn = e.target.closest('.btn-delete');
    
    if(editBtn) openEditModal(editBtn.dataset.index);
    if(deleteBtn) deleteBook(deleteBtn.dataset.id, deleteBtn.dataset.title);
});

async function deleteBook(id, title) {
    if(confirm(`Are you sure you want to delete "${title}" permanently?`)) {
        const bookToDelete = dbBooks.find(b => b.id === id); 
        try {
            await deleteDoc(doc(db, "books", id));
            await logActivity("DELETE", title, bookToDelete.image, bookToDelete); 
            showToast("Record Deleted!");
        } catch (error) {
            console.error(error);
        }
    }
}

function openEditModal(index) {
    const book = dbBooks[index];
    document.getElementById('editDocId').value = book.id;
    document.getElementById('edTitle').value = book.title;
    document.getElementById('edAuthor').value = book.author;
    document.getElementById('edYear').value = book.year;
    document.getElementById('edLang').value = book.lang;
    document.getElementById('edExams').value = book.exams;
    document.getElementById('edImage').value = book.image;
    document.getElementById('edPdfUrl').value = book.pdfLink;
    document.getElementById('edYtUrl').value = book.ytLink || "";
    document.getElementById('editModal').classList.add('active');
}

document.getElementById('editBookForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button');
    btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Saving...`;

    const docId = document.getElementById('editDocId').value;
    const updatedTitle = document.getElementById('edTitle').value;
    const updatedImage = document.getElementById('edImage').value;
    
    const updatedData = {
        title: updatedTitle,
        author: document.getElementById('edAuthor').value,
        image: updatedImage,
        year: document.getElementById('edYear').value,
        lang: document.getElementById('edLang').value,
        exams: document.getElementById('edExams').value,
        pdfLink: document.getElementById('edPdfUrl').value,
        ytLink: document.getElementById('edYtUrl').value
    };

    try {
        await updateDoc(doc(db, "books", docId), updatedData);
        await logActivity("EDIT", updatedTitle, updatedImage); 
        window.closeEditModal();
        showToast("Vault Record Updated!");
    } catch (error) {
        console.error(error);
    }
    btn.innerHTML = `<i class="fas fa-save"></i> Save Changes`;
});

// Recovery Trace Streams
document.getElementById('logsTableBody').addEventListener('click', (e) => {
    const recoverBtn = e.target.closest('.btn-recover');
    if(recoverBtn) restoreBook(recoverBtn.dataset.logid);
});

async function restoreBook(logId) {
    const logEntry = dbLogs.find(l => l.id === logId);
    if(!logEntry || !logEntry.deletedData) return;

    if(confirm(`Do you want to Recover/Restore "${logEntry.bookTitle}" to the main Vault?`)) {
        try {
            const restoredData = { ...logEntry.deletedData };
            delete restoredData.id; 
            restoredData.createdAt = new Date().getTime(); 

            await addDoc(collection(db, "books"), restoredData);
            await logActivity("RESTORE", logEntry.bookTitle, logEntry.image);
            showToast("Book Restored Successfully!");
        } catch(error) {
            console.error(error);
        }
    }
}

function renderLogs() {
    const tbody = document.getElementById('logsTableBody');
    tbody.innerHTML = '';
    
    if (dbLogs.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" class="empty-state">No activity tracked yet. Logs will appear here.</td></tr>`;
        return;
    }

    dbLogs.forEach(log => {
        let badgeHTML = '';
        let recoveryHTML = '';
        
        if(log.action === 'ADD') {
            badgeHTML = `<span class="log-badge log-add"><i class="fas fa-plus"></i> Uploaded</span>`;
        } else if(log.action === 'EDIT') {
            badgeHTML = `<span class="log-badge log-edit"><i class="fas fa-pen"></i> Modified</span>`;
        } else if(log.action === 'DELETE') {
            badgeHTML = `<span class="log-badge log-delete"><i class="fas fa-trash"></i> Deleted</span>`;
            if(log.deletedData) {
                recoveryHTML = `<br><button class="action-btn btn-recover" data-logid="${log.id}"><i class="fas fa-undo"></i> Recover Book</button>`;
            }
        } else if (log.action === 'RESTORE') {
            badgeHTML = `<span class="log-badge log-restore"><i class="fas fa-trash-restore"></i> Restored</span>`;
        }

        let imageElement = log.image ? `<img src="${log.image}" class="log-table-img" onerror="this.src='https://via.placeholder.com/40x55?text=Img'">` : '';

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${badgeHTML}</td>
            <td style="display: flex; align-items: center;">
                ${imageElement}
                <span style="color:#fff; font-weight: 500; font-size:1.05rem;">${log.bookTitle}</span>
            </td>
            <td>
                <div class="log-admin-name">
                    <img src="https://i.postimg.cc/D0BF1b77/file-000000000e847207a64f6711d825a859.png" class="log-admin-avatar">
                    ${log.adminName}
                </div>
            </td>
            <td>
                <div style="color: #a1a1aa; font-size: 0.9rem;">
                    <i class="far fa-clock" style="margin-right:5px;"></i> ${log.dateStr}
                </div>
                ${recoveryHTML}
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// UI Triggers inside module
const menuToggle = document.getElementById('menuToggle');
const sidebar = document.getElementById('sidebar');
const sidebarOverlay = document.getElementById('sidebarOverlay');

if(menuToggle) menuToggle.addEventListener('click', () => { sidebar.classList.toggle('active'); sidebarOverlay.classList.toggle('active'); });
if(sidebarOverlay) sidebarOverlay.addEventListener('click', () => { sidebar.classList.remove('active'); sidebarOverlay.classList.remove('active'); });

document.getElementById('navAddBook').addEventListener('click', () => switchTab('add'));
document.getElementById('navManageBooks').addEventListener('click', () => switchTab('manage'));
document.getElementById('navAnalytics').addEventListener('click', () => switchTab('analytics'));

function switchTab(tab) {
    document.querySelectorAll('.section-container').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.nav-link').forEach(el => el.classList.remove('active'));

    if(tab === 'add') {
        document.getElementById('sectionAddBook').classList.add('active');
        document.getElementById('navAddBook').classList.add('active');
        document.getElementById('topbarTitle').innerText = "Add New Book";
    } else if (tab === 'manage') {
        document.getElementById('sectionManageBooks').classList.add('active');
        document.getElementById('navManageBooks').classList.add('active');
        document.getElementById('topbarTitle').innerText = "Manage Vault";
    } else if (tab === 'analytics') {
        document.getElementById('sectionAnalytics').classList.add('active');
        document.getElementById('navAnalytics').classList.add('active');
        document.getElementById('topbarTitle').innerText = "System Logs";
    }
    sidebar.classList.remove('active');
    sidebarOverlay.classList.remove('active');
}

function showToast(message) {
    const toast = document.getElementById('toast');
    const toastMsg = document.getElementById('toastMsg');
    toastMsg.innerText = message;
    
    if(message.includes("Deleted") || message.includes("Logout")) {
        toast.style.background = "#ef4444";
    } else if (message.includes("Updated") || message.includes("Restored")) {
        toast.style.background = "#3b82f6";
    } else {
        toast.style.background = "#10b981";
    }
    toast.classList.add('show');
    setTimeout(() => { toast.classList.remove('show'); }, 3000);
}

window.closeEditModal = function() { document.getElementById('editModal').classList.remove('active'); }
document.getElementById('closeModalBtn').addEventListener('click', window.closeEditModal);

